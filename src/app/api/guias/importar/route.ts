import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import { fetchCproData } from '@/lib/saw/cpro-client'
import type { SawConfig, CproConfig } from '@/lib/types'
import { computeGuideStatus } from '@/lib/guide-status'
import { classifyGuia } from '@/lib/carteira'
import { parseSawXml } from '@/lib/xml/saw-xml-parser'

/** Service role client — bypasses RLS for trusted server-side DB operations */
function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Global SSE stream timeout in ms (30 minutes — scales for large re-imports) */
const STREAM_TIMEOUT_MS = 30 * 60 * 1000

function timestamp(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false })
}

function sseEvent(type: string, message: string, guide_number?: string): string {
  const payload = JSON.stringify({ type, message, timestamp: timestamp(), guide_number })
  return `data: ${payload}\n\n`
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'guias-importar', 5, 60_000)
  if (limited) return limited

  // Qualquer usuario autenticado pode chamar esta rota —
  // a restricao de volume para visualizador e feita abaixo, apos o parse do body
  const auth = await requireAuth()
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { user, supabase } = auth

  const body = await request.json().catch(() => ({})) as { guide_numbers?: string[] }
  const guideNumbers: string[] = Array.isArray(body.guide_numbers)
    ? body.guide_numbers.filter(Boolean)
    : []

  // Visualizador pode atualizar somente uma guia por vez (botao "Atualizar dados")
  // Importacao em massa e restrita a admin e operador
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile) {
    return new Response(
      JSON.stringify({ error: 'Profile nao encontrado' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (callerProfile.role === 'visualizador' && guideNumbers.length > 1) {
    return new Response(
      JSON.stringify({ error: 'Visualizador pode atualizar apenas uma guia por vez' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (guideNumbers.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Nenhum numero de guia informado' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (type: string, message: string, guide_number?: string) => {
        controller.enqueue(enc.encode(sseEvent(type, message, guide_number)))
      }

      // Global stream timeout — kills the stream if it exceeds STREAM_TIMEOUT_MS
      const streamTimeout = setTimeout(() => {
        try {
          controller.enqueue(enc.encode(sseEvent('error', `Timeout: importacao excedeu ${STREAM_TIMEOUT_MS / 60_000} minutos`)))
          controller.close()
        } catch { /* already closed */ }
      }, STREAM_TIMEOUT_MS)

      // Service role client — bypasses RLS for DB operations
      // Auth + role already validated above; this is trusted server-side code
      const db = getServiceClient()

      try {
        send('info', 'Iniciando importacao...')

        // Load SAW config
        const { data: sawIntegracao, error: sawErr } = await db
          .from('integracoes')
          .select('config, ativo')
          .eq('slug', 'saw')
          .single()

        if (sawErr || !sawIntegracao) {
          send('error', 'Configuracao SAW nao encontrada. Verifique as integracoes.')
          controller.close()
          return
        }

        if (!sawIntegracao.ativo) {
          send('error', 'Integracao SAW esta desativada.')
          controller.close()
          return
        }

        const sawConfig = sawIntegracao.config as SawConfig

        // Load CPro config
        const { data: cproIntegracao } = await db
          .from('integracoes')
          .select('config, ativo')
          .eq('slug', 'cpro')
          .single()

        const cproConfig = cproIntegracao?.config as CproConfig | undefined

        // Check/create SAW session
        send('processing', 'Verificando sessao SAW...')

        const { data: existingSession } = await db
          .from('saw_sessions')
          .select('cookies, expires_at')
          .eq('valida', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let sessionCookies: SawCookie[] | null = existingSession?.cookies
          ? (existingSession.cookies as SawCookie[])
          : null

        // Validate cached session against SAW (cookies may have expired server-side)
        if (sessionCookies) {
          send('processing', 'Validando sessao salva no SAW...')
          const valid = await getSawClient().validateSession(sessionCookies)
          if (!valid) {
            send('info', 'Sessao salva expirou no SAW. Fazendo novo login...')
            sessionCookies = null
            // Mark old session as invalid
            await db
              .from('saw_sessions')
              .update({ valida: false })
              .eq('valida', true)
          }
        }

        if (!sessionCookies) {
          send('processing', 'Fazendo login no SAW...')

          if (!sawConfig.login_url || !sawConfig.usuario || !sawConfig.senha) {
            send('error', 'Configuracao SAW incompleta: login_url, usuario e senha sao obrigatorios.')
            controller.close()
            return
          }

          const loginResult = await getSawClient().login({
            login_url: sawConfig.login_url,
            usuario: sawConfig.usuario,
            senha: sawConfig.senha,
          })

          if (!loginResult.success) {
            send('error', `Falha ao autenticar no SAW: ${loginResult.error ?? 'Verifique as credenciais.'}`)
            controller.close()
            return
          }

          sessionCookies = loginResult.cookies

          await db.from('saw_sessions').insert({
            cookies: sessionCookies,
            valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })

          send('success', 'Login no SAW realizado com sucesso.')
        } else {
          send('success', 'Sessao SAW validada e ativa.')
        }

        const total = guideNumbers.length
        let successCount = 0
        let errorCount = 0
        const startTime = Date.now()
        const MAX_RETRIES = 3
        const RETRY_DELAY_MS = 3_000

        const isSessionError = (msg: string): boolean => {
          const lower = msg.toLowerCase()
          return (
            lower.includes('session closed') ||
            lower.includes('session has been closed') ||
            lower.includes('target closed') ||
            lower.includes('browser has disconnected') ||
            lower.includes('browser disconnected') ||
            lower.includes('protocol error') ||
            lower.includes('connection closed') ||
            lower.includes('websocket is not open') ||
            lower.includes('navegação falhou') ||
            lower.includes('navigation failed')
          )
        }

        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        // Re-login helper: reconnects Browserless + does fresh SAW login
        const reloginSaw = async (): Promise<boolean> => {
          try {
            await getSawClient().forceReconnect()
            send('info', 'Reconexao com Browserless realizada. Refazendo login no SAW...')

            if (!sawConfig.login_url || !sawConfig.usuario || !sawConfig.senha) {
              send('error', 'Impossivel refazer login: configuracao SAW incompleta.')
              return false
            }

            const loginResult = await getSawClient().login({
              login_url: sawConfig.login_url,
              usuario: sawConfig.usuario,
              senha: sawConfig.senha,
            })

            if (!loginResult.success) {
              send('error', `Re-login SAW falhou: ${loginResult.error ?? 'Verifique as credenciais.'}`)
              return false
            }

            // Update session cookies for remaining guides
            sessionCookies = loginResult.cookies

            // Invalidate old sessions and save new one
            await db
              .from('saw_sessions')
              .update({ valida: false })
              .eq('valida', true)

            await db.from('saw_sessions').insert({
              cookies: sessionCookies,
              valida: true,
              expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            })

            send('success', 'Re-login SAW realizado com sucesso. Retomando importacao...')
            return true
          } catch (reconnErr) {
            const reconnMsg = reconnErr instanceof Error ? reconnErr.message : 'Erro desconhecido'
            send('error', `Falha ao reconectar/re-login: ${reconnMsg}`)
            return false
          }
        }

        send('info', `Processando ${total} guia(s)...`)

        // Track per-guide outer retry count to prevent infinite loops
        const outerRetryCount = new Map<number, number>()

        for (let i = 0; i < guideNumbers.length; i++) {
          const guideNumber = guideNumbers[i]
          send('processing', `[${i + 1}/${total}] Buscando guia ${guideNumber} no SAW...`, guideNumber)

          try {
          let sawData: Record<string, unknown> | null = null
          let sawSuccess = false

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            // Wrap readGuide in try-catch to capture both returned errors AND thrown exceptions
            let sawResult: { success: boolean; data?: Record<string, unknown>; error?: string }
            try {
              sawResult = await getSawClient().readGuide(sessionCookies!, guideNumber)
            } catch (readErr) {
              const errMsg = readErr instanceof Error ? readErr.message : 'Erro desconhecido'
              sawResult = { success: false, error: errMsg }
            }

            if (sawResult.success) {
              sawData = sawResult.data ?? null
              sawSuccess = true

              // Log detalhado para SSE — diagnostico de mismatch
              const realizados = typeof sawData?.['procedimentosRealizados'] === 'number' ? sawData['procedimentosRealizados'] : 0
              const detalhes = Array.isArray(sawData?.['procedimentosDetalhes']) ? (sawData['procedimentosDetalhes'] as unknown[]).length : 0
              send('info', `Guia ${guideNumber}: SAW retornou ${realizados} realizados, ${detalhes} detalhes extraidos`, guideNumber)

              if (realizados > 0 && detalhes === 0) {
                send('error', `Guia ${guideNumber}: ALERTA — ${realizados} procedimentos no SAW mas 0 extraidos. Estrutura HTML pode ter mudado.`, guideNumber)
              }

              break
            }

            const msg = sawResult.error ?? 'Erro desconhecido'

            if (isSessionError(msg) && attempt < MAX_RETRIES) {
              send('info', `Guia ${guideNumber}: sessao fechada (${msg}). Reconectando... (tentativa ${attempt + 1}/${MAX_RETRIES})`, guideNumber)
              await sleep(RETRY_DELAY_MS)

              const reloginOk = await reloginSaw()
              if (!reloginOk) {
                send('error', `Guia ${guideNumber}: falha ao reconectar (tentativa ${attempt + 1}/${MAX_RETRIES}).`, guideNumber)
                if (attempt === MAX_RETRIES - 1) {
                  errorCount++
                  break
                }
              }
              continue
            }

            send('error', `Guia ${guideNumber} falhou no SAW: ${msg}`, guideNumber)
            errorCount++
            break
          }

          if (!sawSuccess) continue

          // Try CPro for additional data — failure is non-fatal
          let cproData: Record<string, unknown> | null = null

          if (!cproConfig?.api_url || !cproConfig?.api_key) {
            if (i === 0) {
              send('info', 'CPro nao configurado — pulando busca de procedimentos cadastrados.')
            }
          } else {
            try {
              send('processing', `[${i + 1}/${total}] Buscando dados CPro da guia ${guideNumber}...`, guideNumber)
              const cproResult = await fetchCproData(guideNumber, {
                api_url: cproConfig.api_url,
                api_key: cproConfig.api_key,
                company: cproConfig.company ?? '1',
              })

              if (cproResult) {
                cproData = {
                  procedimentosCadastrados: cproResult.procedimentosCadastrados,
                  userId: cproResult.userId,
                  valorTotal: cproResult.valorTotal,
                  valorTotalFormatado: cproResult.valorTotalFormatado,
                  profissional: cproResult.profissional,
                }
                if (cproResult.procedimentosCadastrados > 0) {
                  send('info', `Guia ${guideNumber}: CPro retornou ${cproResult.procedimentosCadastrados} procedimento(s) cadastrado(s)`, guideNumber)
                } else {
                  send('info', `Guia ${guideNumber}: CPro retornou 0 procedimentos cadastrados`, guideNumber)
                }
              } else {
                send('info', `Guia ${guideNumber}: CPro nao retornou dados (guia nao encontrada na API)`, guideNumber)
              }
            } catch (cproErr) {
              const cproMsg = cproErr instanceof Error ? cproErr.message : 'Erro desconhecido'
              send('info', `Guia ${guideNumber}: CPro falhou (${cproMsg}) — continuando sem dados CPro`, guideNumber)
            }
          }

          // Convert empty strings to null (SAW returns "" for missing fields)
          const orNull = (v: unknown): unknown =>
            typeof v === 'string' && v.trim() === '' ? null : (v ?? null)

          // Parse SAW date format "DD/MM/YYYY" to ISO "YYYY-MM-DD" for Postgres
          const parseDate = (v: unknown): string | null => {
            if (typeof v !== 'string' || !v.trim()) return null
            const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
            if (match) return `${match[3]}-${match[2]}-${match[1]}`
            return null
          }

          // Resolve patient name — prefer SAW, fall back to CPro
          const paciente =
            orNull(sawData?.['nomeBeneficiario']) ??
            orNull(cproData?.['paciente']) ??
            null

          // Extract quantities from SAW data
          const quantidadeSolicitada = typeof sawData?.['quantidadeSolicitada'] === 'number'
            ? sawData['quantidadeSolicitada'] as number
            : null
          const quantidadeAutorizada = typeof sawData?.['quantidadeAutorizada'] === 'number'
            ? sawData['quantidadeAutorizada'] as number
            : null
          const procedimentosRealizados = typeof sawData?.['procedimentosRealizados'] === 'number'
            ? sawData['procedimentosRealizados'] as number
            : 0

          // CPro procedimentos cadastrados
          const procedimentosCadastrados = typeof cproData?.['procedimentosCadastrados'] === 'number'
            ? cproData['procedimentosCadastrados'] as number
            : null

          // Token message from SAW for status computation
          const tokenMessage = typeof sawData?.['tokenMessage'] === 'string'
            ? sawData['tokenMessage'] as string
            : ''

          // Senha e data_autorizacao for status computation
          const senhaRaw = typeof sawData?.['senha'] === 'string' ? sawData['senha'] as string : null
          const dataAutorizacaoRaw = typeof sawData?.['dataAutorizacao'] === 'string' ? sawData['dataAutorizacao'] as string : null

          // SAW status (e.g. "CANCELADA")
          const sawStatus = typeof sawData?.['status'] === 'string' ? sawData['status'] as string : null

          // Compute status
          const status = computeGuideStatus(
            procedimentosCadastrados,
            procedimentosRealizados,
            quantidadeAutorizada,
            tokenMessage,
            senhaRaw,
            dataAutorizacaoRaw,
            sawStatus
          )

          send('info', `Guia ${guideNumber}: status calculado = ${status} (realiz=${procedimentosRealizados}, aut=${quantidadeAutorizada}, cpro=${procedimentosCadastrados}, senha=${senhaRaw ? 'sim' : 'nao'}, dataAut=${dataAutorizacaoRaw ? 'sim' : 'nao'})`, guideNumber)

          // Classify as Local/Intercambio based on carteira prefix
          const numeroCarteira = orNull(sawData?.['numeroCarteira']) as string | null
          const tipoGuia = classifyGuia(numeroCarteira)

          const guiaPayload: Record<string, unknown> = {
            guide_number: guideNumber,
            guide_number_prestador: orNull(sawData?.['numeroGuiaPrestador']),
            paciente,
            numero_carteira: numeroCarteira,
            senha: orNull(sawData?.['senha']),
            data_autorizacao: parseDate(sawData?.['dataAutorizacao']),
            data_validade_senha: parseDate(sawData?.['dataValidadeSenha']),
            data_solicitacao: parseDate(sawData?.['dataSolicitacao']),
            quantidade_solicitada: quantidadeSolicitada,
            quantidade_autorizada: quantidadeAutorizada,
            procedimentos_realizados: procedimentosRealizados,
            codigo_prestador: orNull(sawData?.['codigoPrestador']),
            nome_profissional: orNull(sawData?.['nomeProfissional']),
            cnes: orNull(sawData?.['cnes']),
            tipo_atendimento: orNull(sawData?.['tipoAtendimento']),
            indicacao_acidente: orNull(sawData?.['indicacaoAcidente']),
            indicacao_clinica: orNull(sawData?.['indicacaoClinica']),
            procedimentos_cadastrados: procedimentosCadastrados ?? 0,
            user_id: null,
            valor_total: typeof cproData?.['valorTotal'] === 'number' ? cproData['valorTotal'] : null,
            tipo_guia: tipoGuia,
            token_biometrico: tokenMessage === 'Realize o check-in do Paciente',
            saw_data: sawData,
            cpro_data: cproData,
            status,
            updated_at: new Date().toISOString(),
          }

          const { data: upsertedGuia, error: upsertError } = await db
            .from('guias')
            .upsert(guiaPayload, { onConflict: 'guide_number' })
            .select('id')
            .single()

          if (upsertError || !upsertedGuia) {
            send('error', `Guia ${guideNumber} falhou ao salvar: ${upsertError?.message ?? 'Erro desconhecido'}`, guideNumber)
            errorCount++
            continue
          }

          // Insert/update realized procedure rows from SAW data
          interface ProcDetalhe {
            sequencia: number
            data: string
            horaInicio: string
            horaFim: string
            tabela: string
            codigoProcedimento: string
            descricao: string
            quantidade: number
            via: string
            tecnica: string
            reducaoAcrescimo: number
            valorUnitario: number
            valorTotal: number
          }
          const sawProcedimentos = (sawData?.['procedimentosDetalhes'] ?? []) as ProcDetalhe[]
          if (sawProcedimentos.length > 0) {
            // Delete existing procedures for this guide to avoid duplicates on re-import
            await db
              .from('procedimentos')
              .delete()
              .eq('guia_id', upsertedGuia.id)

            // Professional data from SAW (goes into each procedure row)
            const profNome = typeof sawData?.['nomeProfissional'] === 'string' ? sawData['nomeProfissional'] as string : null
            const profConselho = typeof sawData?.['conselhoProfissional'] === 'string' ? sawData['conselhoProfissional'] as string : null
            const profNumConselho = typeof sawData?.['numeroConselhoProfissional'] === 'string' ? sawData['numeroConselhoProfissional'] as string : null
            const profUf = typeof sawData?.['ufProfissional'] === 'string' ? sawData['ufProfissional'] as string : null
            const profCbos = typeof sawData?.['cbosProfissional'] === 'string' ? sawData['cbosProfissional'] as string : null

            const procRows = sawProcedimentos.map((p) => ({
              guia_id: upsertedGuia.id,
              chave: `${upsertedGuia.id}-${p.sequencia}`,
              sequencia: p.sequencia,
              codigo_tabela: p.tabela || null,
              codigo_procedimento: p.codigoProcedimento || null,
              descricao: p.descricao || null,
              data_execucao: parseDate(p.data),
              hora_inicio: p.horaInicio || null,
              hora_fim: p.horaFim || null,
              quantidade_executada: p.quantidade || 1,
              via_acesso: p.via || null,
              tecnica_utilizada: p.tecnica || null,
              reducao_acrescimo: p.reducaoAcrescimo || 1,
              valor_unitario: p.valorUnitario || null,
              valor_total: p.valorTotal || null,
              nome_profissional: profNome,
              conselho: profConselho,
              numero_conselho: profNumConselho,
              uf: profUf,
              cbos: profCbos,
              status: 'Importado' as const,
            }))

            const { error: procError } = await db
              .from('procedimentos')
              .insert(procRows)

            if (procError) {
              send('info', `Guia ${guideNumber}: falha ao salvar procedimentos (${procError.message})`, guideNumber)
            } else {
              send('info', `Guia ${guideNumber}: ${procRows.length} procedimento(s) realizado(s) importado(s)`, guideNumber)
            }
          }

          // Download XML oficial do SAW para guias COMPLETA
          const sawChave = typeof sawData?.['chave'] === 'string' ? sawData['chave'] as string : null
          const sawTemXML = sawData?.['temXML'] === true

          if (status === 'COMPLETA' && sawChave && sawTemXML) {
            try {
              send('processing', `[${i + 1}/${total}] Baixando XML oficial da guia ${guideNumber}...`, guideNumber)
              const xmlResult = await getSawClient().downloadGuideXml(sessionCookies!, sawChave)

              if (xmlResult.success && xmlResult.xmlContent) {
                const sawXmlData = parseSawXml(xmlResult.xmlContent)

                await db
                  .from('guias')
                  .update({ saw_xml_data: sawXmlData })
                  .eq('id', upsertedGuia.id)

                send('success', `Guia ${guideNumber}: XML oficial baixado e parseado (${xmlResult.xmlContent.length} bytes)`, guideNumber)
              } else {
                send('info', `Guia ${guideNumber}: falha ao baixar XML (${xmlResult.error ?? 'erro desconhecido'})`, guideNumber)
              }
            } catch (xmlErr) {
              const xmlMsg = xmlErr instanceof Error ? xmlErr.message : 'Erro desconhecido'
              send('info', `Guia ${guideNumber}: erro ao processar XML (${xmlMsg})`, guideNumber)
            }
          }

          // SSE: truncar nome do paciente para protecao LGPD (apenas primeiro nome)
          const pacienteLabel = typeof paciente === 'string' && paciente.length > 0
            ? paciente.split(' ')[0]
            : null
          const label = pacienteLabel ? `paciente: ${pacienteLabel}` : 'sem dados de paciente'
          const statusLabel = `status: ${status}`
          const qtdLabel = quantidadeAutorizada != null
            ? `qtd: ${procedimentosRealizados}/${quantidadeAutorizada}`
            : ''
          const details = [label, statusLabel, qtdLabel].filter(Boolean).join(' | ')
          send('success', `Guia ${guideNumber} importada (${details})`, guideNumber)
          successCount++
        } catch (guiaErr) {
          // Per-guide safety net — any unexpected error skips this guide, does NOT kill the loop
          const guiaMsg = guiaErr instanceof Error ? guiaErr.message : 'Erro inesperado'

          const retries = outerRetryCount.get(i) ?? 0
          if (isSessionError(guiaMsg) && retries < MAX_RETRIES) {
            outerRetryCount.set(i, retries + 1)
            send('info', `Guia ${guideNumber}: erro de sessao durante processamento (${guiaMsg}). Reconectando... (recuperacao ${retries + 1}/${MAX_RETRIES})`, guideNumber)
            await sleep(RETRY_DELAY_MS)
            const recovered = await reloginSaw()
            if (recovered) {
              i--
              continue
            }
          }

          send('error', `Guia ${guideNumber}: erro inesperado (${guiaMsg}) — pulando para proxima guia`, guideNumber)
          errorCount++
        }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        send(
          successCount === total ? 'success' : errorCount === total ? 'error' : 'info',
          `Concluido: ${successCount}/${total} guias importadas em ${elapsed}s`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro inesperado'
        controller.enqueue(enc.encode(sseEvent('error', `Erro fatal: ${msg}`)))
      } finally {
        clearTimeout(streamTimeout)
        try { controller.close() } catch { /* already closed by timeout */ }
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
