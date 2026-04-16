import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { buscarFotoBase64, buscarFotoBase64PorSequence } from '@/lib/services/biometria'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'
import { computeGuideStatus } from '@/lib/guide-status'
import { classifyGuia } from '@/lib/carteira'
import https from 'https'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function sseEvent(type: string, message: string): string {
  return `data: ${JSON.stringify({ type, message, timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }) })}\n\n`
}

/**
 * Busca procedimentos pendentes do CPro (atendimentos cadastrados - realizados no SAW)
 */
async function fetchPendingFromCpro(
  guideNumber: string,
  realizedDates: string[],
  cproCfg: Record<string, string>,
): Promise<Array<{
  data: string
  horaInicial: string
  horaFinal: string
  quantidade: string
  viaAcesso: string
  tecnica: string
  redAcresc: string
}>> {
  const cproUrl = `${cproCfg.api_url}/service/api/v1/executions/by-guide-number/${guideNumber}?company=${cproCfg.company ?? '1'}`

  const body = await new Promise<string>((resolve) => {
    const parsed = new URL(cproUrl)
    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'X-API-Key': cproCfg.api_key, Host: 'consultoriopro.com.br', Accept: 'application/json' },
      rejectUnauthorized: false,
      timeout: 15000,
    }, (res) => {
      let data = ''
      res.on('data', (c: Buffer) => { data += c.toString() })
      res.on('end', () => resolve(data))
    })
    req.on('error', () => resolve(''))
    req.on('timeout', () => { req.destroy(); resolve('') })
    req.end()
  })

  if (!body) return []

  try {
    const json = JSON.parse(body)
    if (!json?.data?.attendances) return []

    const attendances = json.data.attendances as Array<{
      date: string
      start: string
      end: string
    }>

    // Filtrar: atendimentos do CPro que NAO foram realizados no SAW
    const pending = attendances.filter((a) => {
      const dateFormatted = a.date // YYYY-MM-DD
      return !realizedDates.includes(dateFormatted)
    })

    return pending.map((a) => {
      // Converter YYYY-MM-DD para DDMMYYYY
      const [y, m, d] = a.date.split('-')
      const dataDDMMYYYY = `${d}${m}${y}`
      // Converter HH:MM:SS para HHMM
      const horaInicial = a.start.replace(/:/g, '').substring(0, 4)
      const horaFinal = a.end.replace(/:/g, '').substring(0, 4)

      return {
        data: dataDDMMYYYY,
        horaInicial,
        horaFinal,
        quantidade: '1',
        viaAcesso: '1',
        tecnica: '1',
        redAcresc: '1.0',
      }
    })
  } catch {
    return []
  }
}

/**
 * POST /api/biometria/cobrar
 * SSE — executa cobranca de procedimentos pendentes no SAW, um a um com verificacao
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'biometria-cobrar', 5, 60_000)
  if (limited) return limited

  const auth = await requireAuth()
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { user } = auth

  const body = await request.json().catch(() => ({})) as {
    guia_id?: string
    atendimentos?: Array<{ date: string; start: string; end: string; photoSequence?: number }>
  }
  if (!body.guia_id) {
    return new Response(JSON.stringify({ error: 'guia_id obrigatorio' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      // Padding inicial + heartbeat periodico para destravar buffering de CF (POST nao e detectado como SSE)
      controller.enqueue(enc.encode(':' + ' '.repeat(8192) + '\n\n'))
      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`: hb${' '.repeat(2048)}\n\n`)) } catch { /* closed */ }
      }, 1000)
      const send = (type: string, message: string) => {
        controller.enqueue(enc.encode(sseEvent(type, message)))
      }

      // Timeout proporcional: 5min por procedimento (com retries) + 3min base
      const numProcs = body.atendimentos?.length ?? 5
      const timeoutMs = (3 + numProcs * 5) * 60 * 1000
      const timeout = setTimeout(() => {
        try { send('error', `Timeout: operacao excedeu ${Math.round(timeoutMs / 60000)} minutos`); controller.close() } catch { /**/ }
      }, timeoutMs)

      const db = getServiceClient()
      const MAX_RETRIES = 2

      try {
        // 1. Buscar guia
        send('processing', '[1/5] Buscando dados da guia...')
        const { data: guia } = await db
          .from('guias')
          .select('id, guide_number, paciente, numero_carteira, procedimentos_realizados, quantidade_autorizada')
          .eq('id', body.guia_id)
          .single()

        if (!guia) { send('error', 'Guia nao encontrada'); controller.close(); return }

        // 2. Buscar procedimentos ja realizados no SAW (datas)
        send('processing', '[2/5] Buscando procedimentos ja realizados...')
        const { data: procRealizados } = await db
          .from('procedimentos')
          .select('data_execucao')
          .eq('guia_id', guia.id)

        const realizedDates = (procRealizados ?? [])
          .map((p) => p.data_execucao)
          .filter(Boolean) as string[]

        // 3. Preparar procedimentos para cobrar
        let atendimentos: Array<{ date: string; start: string; end: string; photoSequence?: number }>

        if (body.atendimentos && body.atendimentos.length > 0) {
          send('processing', `[3/5] ${body.atendimentos.length} atendimento(s) selecionado(s)`)
          atendimentos = body.atendimentos
        } else {
          // Fallback: buscar todos os pendentes do CPro
          send('processing', '[3/5] Buscando procedimentos pendentes no CPro...')
          const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
          if (!cproInteg?.ativo) { send('error', 'CPro nao configurado'); controller.close(); return }
          const cproCfg = cproInteg.config as Record<string, string>
          const pendentes = await fetchPendingFromCpro(guia.guide_number, realizedDates, cproCfg)
          atendimentos = pendentes.map((p) => ({
            date: `${p.data.slice(4, 8)}-${p.data.slice(2, 4)}-${p.data.slice(0, 2)}`,
            start: `${p.horaInicial.slice(0, 2)}:${p.horaInicial.slice(2, 4)}`,
            end: `${p.horaFinal.slice(0, 2)}:${p.horaFinal.slice(2, 4)}`,
          }))
        }

        if (atendimentos.length === 0) {
          send('info', 'Nenhum procedimento pendente encontrado.')
          controller.close(); return
        }
        send('success', `[3/5] ${atendimentos.length} procedimento(s) para cobrar`)

        // 4. Login SAW
        send('processing', '[4/5] Verificando sessao SAW...')
        const { data: sawCred } = await db.from('saw_credentials').select('*').eq('user_id', user.id).eq('ativo', true).single()

        let loginUrl: string, usuario: string, senha: string
        if (sawCred) {
          const cred = sawCred as SawCredentials
          loginUrl = cred.login_url; usuario = cred.usuario; senha = cred.senha
        } else {
          const { data: integ } = await db.from('integracoes').select('config, ativo').eq('slug', 'saw').single()
          if (!integ?.ativo) { send('error', 'Credenciais SAW nao configuradas'); controller.close(); return }
          const cfg = integ.config as Record<string, string>
          loginUrl = cfg.login_url; usuario = cfg.usuario; senha = cfg.senha
        }

        const { data: session } = await db.from('saw_sessions').select('cookies')
          .eq('user_id', user.id).eq('valida', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }).limit(1).single()

        let cookies: SawCookie[] | null = session?.cookies as SawCookie[] | null

        if (!cookies) {
          send('processing', '[4/5] Fazendo login no SAW...')
          const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!loginResult.success) { send('error', `Login falhou: ${loginResult.error}`); controller.close(); return }
          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id, cookies, valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
          send('success', '[4/5] Login SAW realizado.')
        } else {
          send('success', '[4/5] Sessao SAW ativa.')
        }

        // 5. Cobrar um a um com verificacao + retry
        send('processing', `[5/5] Iniciando cobranca de ${atendimentos.length} atendimento(s)...`)

        // Ler procedimentos_realizados ANTES do inicio
        let realizadosAntes = guia.procedimentos_realizados ?? 0

        // Ler do SAW para ter o valor real atual
        const readInicial = await getSawClient().readGuide(user.id, cookies, guia.guide_number)
        if (readInicial.success && readInicial.data) {
          const sawRealizados = typeof readInicial.data['procedimentosRealizados'] === 'number'
            ? readInicial.data['procedimentosRealizados'] as number
            : realizadosAntes
          realizadosAntes = sawRealizados
          send('info', `Procedimentos ja realizados no SAW: ${realizadosAntes}`)
        }

        let totalCobrados = 0
        let pipelineAbortado = false
        let lastReadData: Record<string, unknown> | null = readInicial.data ?? null

        for (let i = 0; i < atendimentos.length; i++) {
          const atendimento = atendimentos[i]
          const stepLabel = `[${i + 1}/${atendimentos.length}]`
          const dataDisplay = atendimento.date.split('-').reverse().join('/')

          // Buscar foto especifica deste atendimento
          let photoBase64: string | null = null
          if (guia.numero_carteira) {
            if (atendimento.photoSequence) {
              photoBase64 = await buscarFotoBase64PorSequence(guia.numero_carteira, atendimento.photoSequence)
            }
            if (!photoBase64) {
              photoBase64 = await buscarFotoBase64(guia.numero_carteira)
            }
          }
          if (!photoBase64) {
            send('error', `${stepLabel} Foto do paciente nao encontrada para atendimento ${dataDisplay}.`)
            pipelineAbortado = true
            break
          }

          // Converter atendimento para formato SAW
          const [y, m, d] = atendimento.date.split('-')
          const proc = {
            data: `${d}${m}${y}`,
            horaInicial: atendimento.start.replace(/:/g, '').substring(0, 4),
            horaFinal: atendimento.end.replace(/:/g, '').substring(0, 4),
            quantidade: '1',
            viaAcesso: '1',
            tecnica: '1',
            redAcresc: '1.0',
          }

          let cobradoComSucesso = false

          for (let retry = 0; retry <= MAX_RETRIES; retry++) {
            const tentativaLabel = retry > 0 ? ` (tentativa ${retry + 1}/3)` : ''
            send('processing', `${stepLabel} Cobrando ${dataDisplay}${tentativaLabel}...`)

            // Cobrar 1 procedimento
            const result = await getSawClient().executarProcedimentos(
              user.id, cookies, guia.guide_number, photoBase64, [proc],
              (step, msg) => send('processing', `${stepLabel} ${msg}`)
            )

            if (!result.success && result.totalExecutado === 0) {
              send('info', `${stepLabel} Execucao retornou erro: ${result.error ?? 'sem detalhes'}`)
              if (retry < MAX_RETRIES) {
                send('info', `${stepLabel} Tentando novamente...`)
                continue
              }
            }

            // Verificar: reimportar guia e checar se procedimentos_realizados aumentou
            send('processing', `${stepLabel} Verificando cobranca de ${dataDisplay}...`)
            const readAfter = await getSawClient().readGuide(user.id, cookies, guia.guide_number)

            if (readAfter.success && readAfter.data) {
              lastReadData = readAfter.data
              const realizadosDepois = typeof readAfter.data['procedimentosRealizados'] === 'number'
                ? readAfter.data['procedimentosRealizados'] as number
                : realizadosAntes

              if (realizadosDepois > realizadosAntes) {
                realizadosAntes = realizadosDepois
                totalCobrados++
                cobradoComSucesso = true
                send('success', `${stepLabel} Atendimento ${dataDisplay} confirmado! (realizados: ${realizadosDepois})`)
                break
              } else {
                if (retry < MAX_RETRIES) {
                  send('info', `${stepLabel} Cobranca de ${dataDisplay} nao confirmada (realizados: ${realizadosDepois}, esperado: >${realizadosAntes}). Tentando novamente...`)
                } else {
                  send('error', `${stepLabel} Cobranca de ${dataDisplay} nao confirmada apos ${MAX_RETRIES + 1} tentativas. Pipeline encerrado.`)
                }
              }
            } else {
              if (retry < MAX_RETRIES) {
                send('info', `${stepLabel} Falha ao verificar guia: ${readAfter.error ?? 'erro desconhecido'}. Tentando novamente...`)
              } else {
                send('error', `${stepLabel} Falha ao verificar guia apos ${MAX_RETRIES + 1} tentativas. Pipeline encerrado.`)
              }
            }
          }

          if (!cobradoComSucesso) {
            pipelineAbortado = true
            break
          }
        }

        // Reimportacao real: salvar dados atualizados no banco
        if (lastReadData) {
          send('processing', 'Salvando dados atualizados no banco...')

          const sawData = lastReadData
          const orNull = (v: unknown): unknown =>
            typeof v === 'string' && v.trim() === '' ? null : (v ?? null)
          const parseDate = (v: unknown): string | null => {
            if (typeof v !== 'string' || !v.trim()) return null
            const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
            if (match) return `${match[3]}-${match[2]}-${match[1]}`
            return null
          }

          const procedimentosRealizados = typeof sawData['procedimentosRealizados'] === 'number'
            ? sawData['procedimentosRealizados'] as number : 0
          const quantidadeAutorizada = typeof sawData['quantidadeAutorizada'] === 'number'
            ? sawData['quantidadeAutorizada'] as number : guia.quantidade_autorizada ?? 0
          const quantidadeSolicitada = typeof sawData['quantidadeSolicitada'] === 'number'
            ? sawData['quantidadeSolicitada'] as number : null
          const tokenMessage = typeof sawData['tokenMessage'] === 'string'
            ? sawData['tokenMessage'] as string : ''
          const senhaRaw = typeof sawData['senha'] === 'string' ? sawData['senha'] as string : null
          const dataAutorizacaoRaw = typeof sawData['dataAutorizacao'] === 'string' ? sawData['dataAutorizacao'] as string : null
          const sawStatus = typeof sawData['status'] === 'string' ? sawData['status'] as string : null

          // Buscar procedimentos_cadastrados do banco (nao muda com cobranca)
          const { data: guiaAtual } = await db
            .from('guias')
            .select('procedimentos_cadastrados, cpro_data, mes_referencia')
            .eq('id', guia.id)
            .single()

          const procedimentosCadastrados = guiaAtual?.procedimentos_cadastrados ?? 0

          // Agreement value per session from CPro data (for correct procedure pricing)
          const cproDataExisting = guiaAtual?.cpro_data as Record<string, unknown> | null
          const agreementValuePerSession = typeof cproDataExisting?.['agreement_value'] === 'number'
            ? cproDataExisting['agreement_value'] as number : null

          const status = computeGuideStatus(
            procedimentosCadastrados,
            procedimentosRealizados,
            quantidadeAutorizada,
            tokenMessage,
            senhaRaw,
            dataAutorizacaoRaw,
            sawStatus
          )

          // Preservar FATURADA/PROCESSADA
          const { data: existingGuia } = await db.from('guias').select('status').eq('id', guia.id).single()
          const PRESERVED_STATUSES = ['FATURADA', 'PROCESSADA']
          const finalStatus = existingGuia && PRESERVED_STATUSES.includes(existingGuia.status)
            ? existingGuia.status : status

          const numeroCarteira = orNull(sawData['numeroCarteira']) as string | null
          const tipoGuia = classifyGuia(numeroCarteira)

          await db.from('guias').update({
            paciente: orNull(sawData['nomeBeneficiario']) ?? guia.paciente,
            numero_carteira: numeroCarteira ?? guia.numero_carteira,
            senha: orNull(sawData['senha']),
            data_autorizacao: parseDate(sawData['dataAutorizacao']),
            data_validade_senha: parseDate(sawData['dataValidadeSenha']),
            data_solicitacao: parseDate(sawData['dataSolicitacao']),
            quantidade_solicitada: quantidadeSolicitada,
            quantidade_autorizada: quantidadeAutorizada,
            procedimentos_realizados: procedimentosRealizados,
            codigo_prestador: orNull(sawData['codigoPrestador']),
            nome_profissional: orNull(sawData['nomeProfissional']),
            cnes: orNull(sawData['cnes']),
            tipo_atendimento: orNull(sawData['tipoAtendimento']),
            indicacao_acidente: orNull(sawData['indicacaoAcidente']),
            indicacao_clinica: orNull(sawData['indicacaoClinica']),
            tipo_guia: tipoGuia,
            token_biometrico: tokenMessage === 'Realize o check-in do Paciente',
            saw_data: sawData,
            status: finalStatus,
            updated_at: new Date().toISOString(),
          }).eq('id', guia.id)

          // Reinserir procedimentos realizados
          const sawProcDetalhes = (sawData['procedimentosDetalhes'] ?? []) as Array<Record<string, string>>
          if (sawProcDetalhes.length > 0) {
            // Deletar procedimentos antigos
            await db.from('procedimentos').delete().eq('guia_id', guia.id)

            const profNome = orNull(sawData['nomeProfissional']) as string | null
            const profConselho = orNull(sawData['conselhoProfissional']) as string | null
            const profNumConselho = orNull(sawData['numeroConselhoProfissional']) as string | null
            const profUf = orNull(sawData['ufProfissional']) as string | null
            const profCbos = orNull(sawData['cbosProfissional']) as string | null

            const procRows = sawProcDetalhes.map((p, idx) => ({
              guia_id: guia.id,
              chave: `${guia.id}-${p.sequencia ?? idx + 1}`,
              sequencia: parseInt(p.sequencia ?? String(idx + 1), 10),
              codigo_tabela: p.tabela || null,
              codigo_procedimento: p.codigoProcedimento || null,
              descricao: p.descricao || null,
              data_execucao: parseDate(p.data),
              hora_inicio: p.horaInicio || null,
              hora_fim: p.horaFim || null,
              quantidade_executada: parseInt(p.quantidade ?? '1', 10) || 1,
              via_acesso: p.via || null,
              tecnica_utilizada: p.tecnica || null,
              reducao_acrescimo: parseFloat(p.reducaoAcrescimo ?? '1') || 1,
              valor_unitario: agreementValuePerSession ?? (p.valorUnitario ? parseFloat(p.valorUnitario) : null),
              valor_total: agreementValuePerSession ?? (p.valorTotal ? parseFloat(p.valorTotal) : null),
              nome_profissional: profNome,
              conselho: profConselho,
              numero_conselho: profNumConselho,
              uf: profUf,
              cbos: profCbos,
              status: 'Importado' as const,
            }))

            const { error: procError } = await db.from('procedimentos').insert(procRows)
            if (procError) {
              send('info', `Falha ao salvar procedimentos: ${procError.message}`)
            } else {
              send('success', `${procRows.length} procedimento(s) realizado(s) salvos no banco`)
            }
          }

          send('success', `Guia atualizada: status=${finalStatus}, realizados=${procedimentosRealizados}`)
        }

        if (pipelineAbortado) {
          send('error', `Pipeline encerrado: ${totalCobrados}/${atendimentos.length} atendimento(s) cobrado(s). Verifique os atendimentos restantes manualmente.`)
        } else {
          send('success', `Concluido: ${totalCobrados}/${atendimentos.length} atendimento(s) cobrado(s) com sucesso!`)
        }
      } catch (err) {
        send('error', `Erro fatal: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      } finally {
        clearTimeout(timeout)
        clearInterval(heartbeat)
        try { controller.close() } catch { /**/ }
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
