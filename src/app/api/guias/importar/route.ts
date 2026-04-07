import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import { fetchCproData, buscarAgreementsUnimed, buscarPatientCpro, buscarPatientByName, buscarExecucoesPendentes, marcarExecucaoRealizada, deletarExecucoesPorGuia } from '@/lib/saw/cpro-client'
import type { SawCredentials, CproConfig } from '@/lib/types'
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

function sseEvent(type: string, message: string, guide_number?: string, extra?: Record<string, unknown>): string {
  const payload = JSON.stringify({ type, message, timestamp: timestamp(), guide_number, ...extra })
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

  const body = await request.json().catch(() => ({})) as { guide_numbers?: string[]; mes_referencia?: string; emission_form_data?: Record<string, unknown>; skip_cpro?: boolean }
  const guideNumbers: string[] = Array.isArray(body.guide_numbers)
    ? body.guide_numbers.filter(Boolean)
    : []
  const mesReferencia = body.mes_referencia

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
      const send = (type: string, message: string, guide_number?: string, extra?: Record<string, unknown>) => {
        controller.enqueue(enc.encode(sseEvent(type, message, guide_number, extra)))
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

        // Load SAW credentials: per-user first, fallback to global integracoes
        const { data: sawCred } = await db
          .from('saw_credentials')
          .select('*')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .single()

        let sawCredentials: SawCredentials

        if (sawCred) {
          sawCredentials = sawCred as SawCredentials
        } else {
          // Fallback: busca config global da tabela integracoes
          send('info', 'Credenciais per-user nao encontradas. Usando config global...')
          const { data: sawInteg, error: sawIntegErr } = await db
            .from('integracoes')
            .select('config, ativo')
            .eq('slug', 'saw')
            .single()

          if (sawIntegErr || !sawInteg?.ativo) {
            send('error', 'Credenciais SAW nao configuradas. Acesse Configuracoes > Credenciais SAW ou Integracoes.')
            controller.close()
            return
          }

          const globalConfig = sawInteg.config as Record<string, string>
          if (!globalConfig.usuario || !globalConfig.senha || !globalConfig.login_url) {
            send('error', 'Config SAW global incompleta: usuario, senha e login_url sao obrigatorios.')
            controller.close()
            return
          }

          sawCredentials = {
            id: 'global',
            user_id: user.id,
            usuario: globalConfig.usuario,
            senha: globalConfig.senha,
            login_url: globalConfig.login_url,
            ativo: true,
            created_at: '',
            updated_at: '',
          }
        }

        // Load CPro config (global, compartilhada)
        const { data: cproIntegracao } = await db
          .from('integracoes')
          .select('config, ativo')
          .eq('slug', 'cpro')
          .single()

        const cproConfig = cproIntegracao?.config as CproConfig | undefined

        // Check/create SAW session for this user
        send('processing', 'Verificando sessao SAW...')

        const { data: existingSession } = await db
          .from('saw_sessions')
          .select('cookies, expires_at')
          .eq('user_id', user.id)
          .eq('valida', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let sessionCookies: SawCookie[] | null = existingSession?.cookies
          ? (existingSession.cookies as SawCookie[])
          : null

        // Validate cached session against SAW
        if (sessionCookies) {
          send('processing', 'Validando sessao salva no SAW...')
          const valid = await getSawClient().validateSession(user.id, sessionCookies)
          if (!valid) {
            send('info', 'Sessao salva expirou no SAW. Fazendo novo login...')
            sessionCookies = null
            await db
              .from('saw_sessions')
              .update({ valida: false })
              .eq('user_id', user.id)
              .eq('valida', true)
          }
        }

        if (!sessionCookies) {
          send('processing', 'Fazendo login no SAW...')

          const loginResult = await getSawClient().login(user.id, {
            login_url: sawCredentials.login_url,
            usuario: sawCredentials.usuario,
            senha: sawCredentials.senha,
          })

          if (!loginResult.success) {
            send('error', `Falha ao autenticar no SAW: ${loginResult.error ?? 'Verifique as credenciais.'}`)
            controller.close()
            return
          }

          sessionCookies = loginResult.cookies

          await db.from('saw_sessions').insert({
            user_id: user.id,
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

        const isNetworkError = (msg: string): boolean => {
          const lower = msg.toLowerCase()
          return (
            lower.includes('network error') ||
            lower.includes('net::err_') ||
            lower.includes('timeout') ||
            lower.includes('timed out') ||
            lower.includes('etimedout') ||
            lower.includes('econnrefused') ||
            lower.includes('econnreset') ||
            lower.includes('err_connection')
          )
        }

        const NETWORK_RETRY_DELAY_MS = 30_000

        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

        // Re-login helper: reconnects browser context + does fresh SAW login
        const reloginSaw = async (): Promise<boolean> => {
          try {
            await getSawClient().forceReconnect(user.id)
            send('info', 'Reconexao realizada. Refazendo login no SAW...')

            const loginResult = await getSawClient().login(user.id, {
              login_url: sawCredentials.login_url,
              usuario: sawCredentials.usuario,
              senha: sawCredentials.senha,
            })

            if (!loginResult.success) {
              send('error', `Re-login SAW falhou: ${loginResult.error ?? 'Verifique as credenciais.'}`)
              return false
            }

            // Update session cookies for remaining guides
            sessionCookies = loginResult.cookies

            // Invalidate old sessions and save new one (per user)
            await db
              .from('saw_sessions')
              .update({ valida: false })
              .eq('user_id', user.id)
              .eq('valida', true)

            await db.from('saw_sessions').insert({
              user_id: user.id,
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
              sawResult = await getSawClient().readGuide(user.id, sessionCookies!, guideNumber)
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

            // Network/timeout errors: aguarda 30s e retenta sem relogin
            if (isNetworkError(msg) && attempt < MAX_RETRIES) {
              send('info', `Guia ${guideNumber}: erro de rede/timeout (${msg}). Aguardando 30s... (tentativa ${attempt + 1}/${MAX_RETRIES})`, guideNumber)
              await sleep(NETWORK_RETRY_DELAY_MS)
              continue
            }

            send('error', `Guia ${guideNumber} falhou no SAW: ${msg}`, guideNumber)
            errorCount++
            break
          }

          if (!sawSuccess) continue

          // Try CPro for additional data — failure is non-fatal
          // skip_cpro: pipeline de emissao pula esta consulta (CPro sera consultado apos cadastro no step 4)
          let cproData: Record<string, unknown> | null = null

          if (body.skip_cpro) {
            send('info', `Guia ${guideNumber}: consulta CPro sera feita apos cadastro (step 4)`, guideNumber)
          } else if (!cproConfig?.api_url || !cproConfig?.api_key) {
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

                // Enrich with agreement and patient for CPro modal pre-fill
                const cproCfg = { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' }
                const codigoProc = typeof sawData?.['codigoProcedimentoSolicitado'] === 'string'
                  ? sawData['codigoProcedimentoSolicitado'] as string
                  : ''
                const rawNome = sawData?.['nomeBeneficiario']
                const pacienteNome = (typeof rawNome === 'string' && rawNome.trim() !== '' ? rawNome.trim() : null) as string | null

                // Buscar paciente — priorizar carteira (documento) sobre nome para evitar homonimos
                const rawCarteira = sawData?.['numeroCarteira']
                // CPro espera carteira sem prefixo 865/0865
                const carteiraBusca = (typeof rawCarteira === 'string' && rawCarteira.trim() !== ''
                  ? rawCarteira.trim().replace(/^0?865/, '')
                  : null) as string | null

                const [agreements, patientByDoc, patientByName] = await Promise.all([
                  buscarAgreementsUnimed(cproCfg),
                  carteiraBusca ? buscarPatientCpro(cproCfg, carteiraBusca) : Promise.resolve(null),
                  pacienteNome ? buscarPatientByName(cproCfg, pacienteNome) : Promise.resolve(null),
                ])
                const patient = patientByDoc ?? patientByName

                // Match agreement by procedure code
                const matchedAg = codigoProc
                  ? agreements.find((ag) => ag.title.startsWith(codigoProc))
                  : null

                if (matchedAg) {
                  cproData.agreement_id = matchedAg.id
                  cproData.agreement_value = matchedAg.value
                  cproData.agreement_title = matchedAg.title
                }
                if (patient) {
                  cproData.patient_id = patient.id
                  cproData.patient_name = patient.name
                }
                // user from CPro (professional)
                if (cproResult.userId) {
                  cproData.user_id = Number(cproResult.userId)
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
          let procedimentosRealizados = typeof sawData?.['procedimentosRealizados'] === 'number'
            ? sawData['procedimentosRealizados'] as number
            : 0

          // CPro procedimentos cadastrados
          const procedimentosCadastrados = typeof cproData?.['procedimentosCadastrados'] === 'number'
            ? cproData['procedimentosCadastrados'] as number
            : null

          // Se SAW retornou 0 realizados mas CPro tem cadastrados, usar CPro como realizados
          if (procedimentosRealizados === 0 && procedimentosCadastrados && procedimentosCadastrados > 0) {
            procedimentosRealizados = procedimentosCadastrados
          }

          // Token message from SAW for status computation
          const tokenMessage = typeof sawData?.['tokenMessage'] === 'string'
            ? sawData['tokenMessage'] as string
            : ''

          // Fallback: when readGuide hit token page, use emission form data
          const efd = body.emission_form_data
          if (tokenMessage === 'Realize o check-in do Paciente' && efd && sawData) {
            const fallback = (sawKey: string, efdKey: string) => {
              if (!sawData[sawKey] && efd[efdKey]) {
                ;(sawData as Record<string, unknown>)[sawKey] = efd[efdKey]
              }
            }
            fallback('senha', 'senha')
            fallback('dataAutorizacao', 'dataAutorizacao')
            fallback('dataValidadeSenha', 'dataValidadeSenha')
            fallback('dataSolicitacao', 'dataSolicitacao')
            fallback('nomeProfissional', 'nomeProfissional')
            fallback('numeroCarteira', 'numeroCarteira')
            fallback('codigoPrestador', 'codigoPrestador')
            fallback('cnes', 'cnes')
            fallback('nomeBeneficiario', 'nomeBeneficiario')
            fallback('codigoProcedimentoSolicitado', 'codigoProcedimentoSolicitado')
            if (!sawData['quantidadeSolicitada'] && efd.quantidadeSolicitada) {
              ;(sawData as Record<string, unknown>)['quantidadeSolicitada'] = efd.quantidadeSolicitada
            }
            if (!sawData['quantidadeAutorizada'] && efd.quantidadeAutorizada) {
              ;(sawData as Record<string, unknown>)['quantidadeAutorizada'] = efd.quantidadeAutorizada
            }
            send('info', `Guia ${guideNumber}: usando dados da emissao como fallback (token page)`, guideNumber)
          }

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

          // Preserve FATURADA/PROCESSADA — reimport must not regress these statuses
          const PRESERVED_STATUSES = ['FATURADA', 'PROCESSADA']
          const { data: existingGuia } = await db
            .from('guias')
            .select('status')
            .eq('guide_number', guideNumber)
            .single()

          const finalStatus = existingGuia && PRESERVED_STATUSES.includes(existingGuia.status)
            ? existingGuia.status
            : status

          send('info', `Guia ${guideNumber}: status = ${finalStatus}${finalStatus !== status ? ` (preservado, calculado seria ${status})` : ''} (realiz=${procedimentosRealizados}, aut=${quantidadeAutorizada}, cpro=${procedimentosCadastrados})`, guideNumber)

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
            user_id: null,
            tipo_guia: tipoGuia,
            token_biometrico: tokenMessage === 'Realize o check-in do Paciente',
            saw_data: sawData,
            status: finalStatus,
            updated_at: new Date().toISOString(),
          }

          // Only set mes_referencia on first import (when provided).
          // Reimports (without mes_referencia) preserve the existing value.
          if (mesReferencia) {
            guiaPayload.mes_referencia = mesReferencia
          }

          // Agreement value per session (from CPro current or existing DB data)
          let agreementValuePerSession: number | null = null

          // CANCELADA/NEGADA — limpar dados CPro e deletar execucoes no CPro
          if (finalStatus === 'CANCELADA' || finalStatus === 'NEGADA') {
            guiaPayload.cpro_data = null
            guiaPayload.procedimentos_cadastrados = 0
            guiaPayload.valor_total = 0

            // Deletar execucoes no CPro externo
            if (cproConfig?.api_url && cproConfig?.api_key) {
              try {
                const cproCfg = { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' }
                const { deleted, errors } = await deletarExecucoesPorGuia(cproCfg, guideNumber)
                if (deleted > 0 || errors > 0) {
                  send('info', `Guia ${guideNumber}: ${deleted} execucao(oes) deletada(s) no CPro${errors > 0 ? `, ${errors} erro(s)` : ''}`, guideNumber)
                }
              } catch (delErr) {
                send('info', `Guia ${guideNumber}: falha ao deletar execucoes CPro — ${delErr instanceof Error ? delErr.message : 'erro'}`, guideNumber)
              }
            }

            send('info', `Guia ${guideNumber}: status ${finalStatus} — dados CPro removidos`, guideNumber)
          }
          // Only overwrite CPro-derived fields when CPro returned data.
          // On reimport, if CPro API fails/returns null, preserve existing cpro_data,
          // valor_total and procedimentos_cadastrados already stored in the DB.
          else if (cproData !== null) {
            guiaPayload.cpro_data = cproData
            guiaPayload.procedimentos_cadastrados = procedimentosCadastrados ?? 0

            // Recalculate valor_total from agreement value if available
            const agValue = typeof cproData['agreement_value'] === 'number' ? cproData['agreement_value'] as number : null
            const qtdAut = quantidadeAutorizada ?? 0
            if (agValue && agValue > 0 && qtdAut > 0) {
              guiaPayload.valor_total = agValue * qtdAut
              agreementValuePerSession = agValue
            } else {
              guiaPayload.valor_total = typeof cproData['valorTotal'] === 'number' ? cproData['valorTotal'] : null
            }
          } else {
            // CPro retornou null — guia nao encontrada no CPro. Limpar dados locais.
            guiaPayload.cpro_data = null
            guiaPayload.procedimentos_cadastrados = 0
            // Preservar valor_total do agreement existente para calculo de lote
            const { data: existingCpro } = await db
              .from('guias')
              .select('cpro_data')
              .eq('guide_number', guideNumber)
              .single()
            const existingAg = typeof (existingCpro?.cpro_data as Record<string, unknown> | null)?.['agreement_value'] === 'number'
              ? (existingCpro?.cpro_data as Record<string, unknown>)['agreement_value'] as number
              : null
            if (existingAg && existingAg > 0) {
              agreementValuePerSession = existingAg
            }
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

          // Recalculate lote valor_total if guia belongs to a lote
          if (existingGuia) {
            const { data: guiaWithLote } = await db
              .from('guias')
              .select('lote_id')
              .eq('id', upsertedGuia.id)
              .single()

            if (guiaWithLote?.lote_id) {
              const { data: loteGuias } = await db
                .from('guias')
                .select('valor_total')
                .eq('lote_id', guiaWithLote.lote_id)

              if (loteGuias) {
                const somaLote = loteGuias.reduce((acc, g) => acc + (g.valor_total ?? 0), 0)
                await db
                  .from('lotes')
                  .update({ valor_total: somaLote })
                  .eq('id', guiaWithLote.lote_id)
              }
            }
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
          // Procedimentos realizados vem SEMPRE do SAW (nunca do CPro)
          // Limpa procedimentos existentes e reinsere do SAW
          const sawProcedimentos = (sawData?.['procedimentosDetalhes'] ?? []) as ProcDetalhe[]

          // Sempre deletar procedimentos antigos na reimportacao
          await db
            .from('procedimentos')
            .delete()
            .eq('guia_id', upsertedGuia.id)

          if (sawProcedimentos.length > 0) {
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
              valor_unitario: agreementValuePerSession ?? p.valorUnitario ?? null,
              valor_total: agreementValuePerSession ?? p.valorTotal ?? null,
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
              send('info', `Guia ${guideNumber}: ${procRows.length} procedimento(s) realizado(s) importado(s) do SAW`, guideNumber)
            }
          } else if (procedimentosRealizados > 0) {
            send('info', `Guia ${guideNumber}: SAW reportou ${procedimentosRealizados} realizados mas 0 detalhes extraidos`, guideNumber)
          }

          // Parse XML oficial do SAW (baixado durante readGuide, na mesma pagina)
          // Somente salva XML quando a guia atingiu status COMPLETA — outros status nao tem dados definitivos
          const sawXmlContent = typeof sawData?.['xmlContent'] === 'string' ? sawData['xmlContent'] as string : null

          if (sawXmlContent && status === 'COMPLETA') {
            try {
              const sawXmlData = parseSawXml(sawXmlContent)

              await db
                .from('guias')
                .update({ saw_xml_data: sawXmlData })
                .eq('id', upsertedGuia.id)

              send('success', `Guia ${guideNumber}: XML oficial parseado (${sawXmlContent.length} bytes)`, guideNumber)
            } catch (xmlErr) {
              const xmlMsg = xmlErr instanceof Error ? xmlErr.message : 'Erro desconhecido'
              send('info', `Guia ${guideNumber}: erro ao processar XML (${xmlMsg})`, guideNumber)
            }
          } else if (sawXmlContent && status !== 'COMPLETA') {
            send('info', `Guia ${guideNumber}: XML nao salvo (status != COMPLETA, status atual = ${status})`, guideNumber)
          }

          // ─── Match realized SAW procedures with pending CPro executions ───
          if (sawProcedimentos.length > 0 && cproConfig?.api_url && cproConfig?.api_key) {
            try {
              const cproCfg = { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' }
              send('processing', `Guia ${guideNumber}: Sincronizando cobrancas com CPro...`, guideNumber)
              const pendentes = await buscarExecucoesPendentes(cproCfg, guideNumber)

              // Check if CPro already has enough realized — skip if so
              const totalCadastradas = procedimentosCadastrados ?? 0
              const jaRealizadas = totalCadastradas - pendentes.length
              if (jaRealizadas >= sawProcedimentos.length) {
                send('info', `Guia ${guideNumber}: CPro ja tem ${jaRealizadas} realizada(s), SAW tem ${sawProcedimentos.length} — nada a atualizar`, guideNumber)
              } else if (pendentes.length > 0) {
                send('info', `Guia ${guideNumber}: ${pendentes.length} pendente(s) no CPro, ${jaRealizadas} realizada(s), ${sawProcedimentos.length} no SAW`, guideNumber)
                // Convert SAW dates (DD/MM/YYYY) to YYYY-MM-DD for comparison
                const sawDates = sawProcedimentos.map((p) => {
                  const parts = p.data.split('/')
                  const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : p.data
                  return { isoDate, horaInicio: p.horaInicio || '08:00', horaFim: p.horaFim || '08:30' }
                })

                // Convert CPro pending dates (DD/MM/YYYY) to YYYY-MM-DD
                const cproPending = pendentes.map((p) => {
                  const parts = p.data.split('/')
                  const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : p.data
                  return { ...p, isoDate }
                })

                // Greedy closest-date matching
                const used = new Set<number>()
                let matched = 0

                for (const saw of sawDates) {
                  const sawMs = new Date(saw.isoDate + 'T12:00:00').getTime()
                  let bestIdx = -1
                  let bestDiff = Infinity

                  for (let i = 0; i < cproPending.length; i++) {
                    if (used.has(i)) continue
                    const cproMs = new Date(cproPending[i].isoDate + 'T12:00:00').getTime()
                    const diff = Math.abs(sawMs - cproMs)
                    if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
                  }

                  if (bestIdx >= 0) {
                    used.add(bestIdx)
                    const exec = cproPending[bestIdx]
                    // Keep CPro's original attendance_day — only update status
                    const result = await marcarExecucaoRealizada(cproCfg, exec.id, {
                      attendance_day: exec.isoDate,
                      attendance_start: exec.horaInicial,
                      attendance_end: exec.horaFinal,
                    })
                    if (result.success) matched++
                  }
                }

                if (matched > 0) {
                  send('info', `Guia ${guideNumber}: ${matched} cobranca(s) marcada(s) como realizada(s) no CPro`, guideNumber)
                }
              }
            } catch (matchErr) {
              const matchMsg = matchErr instanceof Error ? matchErr.message : 'Erro'
              send('info', `Guia ${guideNumber}: falha ao sincronizar CPro (${matchMsg})`, guideNumber)
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
          send('success', `Guia ${guideNumber} importada (${details})`, guideNumber, { guia_id: upsertedGuia.id })
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

          if (isNetworkError(guiaMsg) && retries < MAX_RETRIES) {
            outerRetryCount.set(i, retries + 1)
            send('info', `Guia ${guideNumber}: erro de rede/timeout (${guiaMsg}). Aguardando 30s... (recuperacao ${retries + 1}/${MAX_RETRIES})`, guideNumber)
            await sleep(NETWORK_RETRY_DELAY_MS)
            i--
            continue
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
