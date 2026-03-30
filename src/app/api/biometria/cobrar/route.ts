import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { buscarFotoBase64, buscarFotoBase64PorSequence } from '@/lib/services/biometria'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'
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
 * SSE — executa cobranca de procedimentos pendentes no SAW
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
      const send = (type: string, message: string) => {
        controller.enqueue(enc.encode(sseEvent(type, message)))
      }

      // Timeout proporcional: 3min por procedimento + 2min base (login/setup)
      const numProcs = body.atendimentos?.length ?? 5
      const timeoutMs = (2 + numProcs * 3) * 60 * 1000
      const timeout = setTimeout(() => {
        try { send('error', `Timeout: operacao excedeu ${Math.round(timeoutMs / 60000)} minutos`); controller.close() } catch { /**/ }
      }, timeoutMs)

      const db = getServiceClient()

      try {
        // 1. Buscar guia
        send('processing', '[1/7] Buscando dados da guia...')
        const { data: guia } = await db
          .from('guias')
          .select('id, guide_number, paciente, numero_carteira, procedimentos_realizados')
          .eq('id', body.guia_id)
          .single()

        if (!guia) { send('error', 'Guia nao encontrada'); controller.close(); return }

        // 2. Buscar foto (específica por sequence ou aleatória)
        const requestedSequence = body.atendimentos?.[0]?.photoSequence
        send('processing', `[2/7] Buscando foto do paciente${requestedSequence ? ` (#${requestedSequence})` : ' (aleatoria)'}...`)
        let photoBase64: string | null = null
        if (guia.numero_carteira) {
          if (requestedSequence) {
            photoBase64 = await buscarFotoBase64PorSequence(guia.numero_carteira, requestedSequence)
          }
          if (!photoBase64) {
            photoBase64 = await buscarFotoBase64(guia.numero_carteira)
          }
        }
        if (!photoBase64) {
          send('error', 'Foto do paciente nao encontrada. Capture a foto primeiro.')
          controller.close(); return
        }
        send('success', `[2/7] Foto encontrada para ${guia.paciente?.split(' ')[0] ?? 'paciente'}`)

        // 3. Buscar procedimentos ja realizados no SAW (datas)
        send('processing', '[3/7] Buscando procedimentos ja realizados...')
        const { data: procRealizados } = await db
          .from('procedimentos')
          .select('data_execucao')
          .eq('guia_id', guia.id)

        const realizedDates = (procRealizados ?? [])
          .map((p) => p.data_execucao)
          .filter(Boolean) as string[]

        // 4. Preparar procedimentos para cobrar
        let pendentes: Array<{ data: string; horaInicial: string; horaFinal: string; quantidade: string; viaAcesso: string; tecnica: string; redAcresc: string }>

        if (body.atendimentos && body.atendimentos.length > 0) {
          // Atendimentos selecionados pelo operador
          send('processing', `[4/7] ${body.atendimentos.length} atendimento(s) selecionado(s)`)
          pendentes = body.atendimentos.map((a) => {
            const [y, m, d] = a.date.split('-')
            return {
              data: `${d}${m}${y}`,
              horaInicial: a.start.replace(/:/g, '').substring(0, 4),
              horaFinal: a.end.replace(/:/g, '').substring(0, 4),
              quantidade: '1',
              viaAcesso: '1',
              tecnica: '1',
              redAcresc: '1.0',
            }
          })
        } else {
          // Fallback: buscar todos os pendentes do CPro
          send('processing', '[4/7] Buscando procedimentos pendentes no CPro...')
          const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
          if (!cproInteg?.ativo) { send('error', 'CPro nao configurado'); controller.close(); return }
          const cproCfg = cproInteg.config as Record<string, string>
          pendentes = await fetchPendingFromCpro(guia.guide_number, realizedDates, cproCfg)
        }

        if (pendentes.length === 0) {
          send('info', 'Nenhum procedimento pendente encontrado.')
          controller.close(); return
        }
        send('success', `[4/7] ${pendentes.length} procedimento(s) para cobrar`)

        // 5. Login SAW
        send('processing', '[5/7] Verificando sessao SAW...')
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
          send('processing', '[5/7] Fazendo login no SAW...')
          const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!loginResult.success) { send('error', `Login falhou: ${loginResult.error}`); controller.close(); return }
          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id, cookies, valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
          send('success', '[5/7] Login SAW realizado.')
        } else {
          send('success', '[5/7] Sessao SAW ativa.')
        }

        // 6. Executar procedimentos
        send('processing', `[6/7] Executando ${pendentes.length} procedimento(s) no SAW...`)
        const result = await getSawClient().executarProcedimentos(
          user.id, cookies, guia.guide_number, photoBase64, pendentes,
          (step, msg) => send('processing', `[6/7] [${step}] ${msg}`)
        )

        if (result.success) {
          send('success', `[6/7] ${result.totalExecutado}/${result.totalEsperado} procedimento(s) cobrado(s)!`)
        } else {
          send('error', `[6/7] Cobranca falhou: ${result.error ?? `${result.totalExecutado}/${result.totalEsperado} executados`}`)
        }

        // 7. Reimportar guia
        send('processing', '[7/7] Reimportando guia...')
        const readResult = await getSawClient().readGuide(user.id, cookies, guia.guide_number)
        if (readResult.success) {
          send('success', '[7/7] Guia reimportada.')
        } else {
          send('info', `Reimportacao falhou: ${readResult.error}`)
        }

        send('success', `Concluido: ${result.totalExecutado}/${result.totalEsperado} procedimento(s) cobrado(s)`)
      } catch (err) {
        send('error', `Erro fatal: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
      } finally {
        clearTimeout(timeout)
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
