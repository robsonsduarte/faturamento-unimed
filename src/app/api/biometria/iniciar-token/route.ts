import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/biometria/iniciar-token
 * SSE streaming — opens SAW token page and streams progress.
 * Final event contains sessionId, methods, phones.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'biometria-iniciar', 10, 60_000)
  if (limited) return limited

  const auth = await requireAuth()
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { user } = auth

  const body = await request.json().catch(() => ({})) as { guia_id?: string }
  if (!body.guia_id) {
    return new Response(JSON.stringify({ error: 'guia_id obrigatorio' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const timeout = setTimeout(() => {
        try {
          send({ type: 'error', message: 'Timeout: operacao excedeu 2 minutos' })
          controller.close()
        } catch { /* */ }
      }, 2 * 60 * 1000)

      const db = getServiceClient()

      try {
        send({ type: 'processing', message: 'Buscando dados da guia...' })

        const { data: guia } = await db
          .from('guias')
          .select('id, guide_number, paciente, numero_carteira')
          .eq('id', body.guia_id)
          .single()

        if (!guia) {
          send({ type: 'error', message: 'Guia nao encontrada' })
          controller.close()
          return
        }

        // Buscar credenciais SAW
        send({ type: 'processing', message: 'Verificando credenciais SAW...' })

        const { data: sawCred } = await db
          .from('saw_credentials')
          .select('*')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .single()

        let loginUrl: string, usuario: string, senha: string

        if (sawCred) {
          const cred = sawCred as SawCredentials
          loginUrl = cred.login_url; usuario = cred.usuario; senha = cred.senha
        } else {
          const { data: integ } = await db.from('integracoes').select('config, ativo').eq('slug', 'saw').single()
          if (!integ?.ativo) {
            send({ type: 'error', message: 'Credenciais SAW nao configuradas' })
            controller.close()
            return
          }
          const cfg = integ.config as Record<string, string>
          loginUrl = cfg.login_url; usuario = cfg.usuario; senha = cfg.senha
        }

        // Buscar sessao
        const { data: session } = await db
          .from('saw_sessions')
          .select('cookies')
          .eq('user_id', user.id)
          .eq('valida', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let cookies: SawCookie[] | null = session?.cookies as SawCookie[] | null

        if (!cookies) {
          send({ type: 'processing', message: 'Fazendo login no SAW...' })
          const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!loginResult.success) {
            send({ type: 'error', message: `Login SAW falhou: ${loginResult.error}` })
            controller.close()
            return
          }
          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id, cookies, valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
          send({ type: 'success', message: 'Login realizado.' })
        } else {
          send({ type: 'success', message: 'Sessao SAW ativa.' })
        }

        // Abrir pagina de token
        send({ type: 'processing', message: 'Abrindo guia no SAW...' })
        let result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number)

        // Retry se sessao expirou
        if (!result.success && result.error?.includes('expirou')) {
          send({ type: 'processing', message: 'Sessao expirou. Refazendo login...' })
          await db.from('saw_sessions').update({ valida: false }).eq('user_id', user.id).eq('valida', true)
          const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!loginResult.success) {
            send({ type: 'error', message: `Re-login falhou: ${loginResult.error}` })
            controller.close()
            return
          }
          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id, cookies, valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
          result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number)
        }

        if (!result.success) {
          send({ type: 'error', message: result.error ?? 'Erro ao abrir pagina de token' })
          controller.close()
          return
        }

        send({ type: 'success', message: 'Pagina de token aberta no SAW.' })

        // Buscar telefone do paciente no CPro
        send({ type: 'processing', message: 'Buscando telefone do paciente...' })

        let patientPhone = ''
        try {
          const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
          if (cproInteg?.ativo) {
            const cproCfg = cproInteg.config as Record<string, string>
            const cproUrl = `${cproCfg.api_url}/service/api/v1/executions/by-guide-number/${guia.guide_number}?company=${cproCfg.company ?? '1'}`

            const https = await import('https')
            const cproRes = await new Promise<string>((resolve) => {
              const parsed = new URL(cproUrl)
              const req = https.request({
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: 'GET',
                headers: { 'X-API-Key': cproCfg.api_key, Host: 'consultoriopro.com.br', Accept: 'application/json' },
                rejectUnauthorized: false,
                timeout: 10000,
              }, (res) => {
                let body = ''
                res.on('data', (c: Buffer) => { body += c.toString() })
                res.on('end', () => resolve(body))
              })
              req.on('error', () => resolve(''))
              req.on('timeout', () => { req.destroy(); resolve('') })
              req.end()
            })

            if (cproRes) {
              const cproJson = JSON.parse(cproRes)
              const mobile = cproJson?.data?.patient?.mobile as string ?? ''
              if (mobile) {
                patientPhone = mobile.replace(/\D/g, '')
                if (!patientPhone.startsWith('55')) patientPhone = `55${patientPhone}`
              }
            }
          }
        } catch {
          // CPro falhou — continua sem telefone
        }

        if (!patientPhone) {
          // Fallback: retorna resultado para o usuario preencher manualmente
          send({
            type: 'result',
            success: true,
            sessionId: result.sessionId,
            guideNumber: guia.guide_number,
            paciente: guia.paciente,
            methods: result.methods,
            phones: result.phones,
            patientPhone: '',
            autoSent: false,
          })
          controller.close()
          return
        }

        send({ type: 'success', message: `Telefone encontrado: ${patientPhone.replace(/^55(\d{2})(\d+)/, '($1) $2')}` })

        // Selecionar metodo "Aplicativo" automaticamente
        send({ type: 'processing', message: 'Selecionando metodo Aplicativo...' })
        await getSawClient().selectTokenMethod(result.sessionId!, 'aplicativo')

        // Enviar WhatsApp automaticamente
        send({ type: 'processing', message: 'Enviando WhatsApp ao paciente...' })

        const evolutionUrl = process.env.EVOLUTION_API_URL ?? ''
        const evolutionKey = process.env.EVOLUTION_API_KEY ?? ''
        const instanceName = process.env.EVOLUTION_INSTANCE ?? 'Espaço Dedicare'

        const whatsappMsg = [
          `Ola! Precisamos do *token de atendimento* para a guia do paciente *${guia.paciente ?? ''}*.`,
          '',
          'Por favor, siga os passos:',
          '1. Abra o *aplicativo da Unimed* no celular',
          '2. Acesse a *carteira digital*',
          '3. Copie o *token de 6 digitos* gerado',
          '4. *Responda esta mensagem* com o token',
          '',
          'O token expira em *4 minutos e 30 segundos*.',
          '',
          '_Clinica Dedicare - Faturamento_',
        ].join('\n')

        let whatsappSent = false
        if (evolutionKey) {
          try {
            const jid = `${patientPhone}@s.whatsapp.net`
            const wRes = await fetch(`${evolutionUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
              body: JSON.stringify({ number: jid, text: whatsappMsg }),
            })
            whatsappSent = wRes.ok
          } catch { /* */ }
        }

        // Criar token_request para tracking
        let requestId = ''
        try {
          const { data: tokenReq } = await db.from('token_requests').insert({
            guia_id: guia.id,
            guide_number: guia.guide_number,
            paciente_nome: guia.paciente ?? '',
            phone_whatsapp: patientPhone,
            method: 'aplicativo',
            session_id: result.sessionId!,
            status: 'waiting',
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            created_by: user.id,
          }).select('id').single()
          requestId = tokenReq?.id ?? ''
        } catch { /* */ }

        const phoneDisplay = patientPhone.replace(/^55(\d{2})(\d+)/, '($1) $2')
        send({
          type: 'result',
          success: true,
          sessionId: result.sessionId,
          guideNumber: guia.guide_number,
          paciente: guia.paciente,
          methods: result.methods,
          phones: result.phones,
          patientPhone,
          phoneDisplay,
          autoSent: whatsappSent,
          requestId,
        })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Erro interno' })
      } finally {
        clearTimeout(timeout)
        try { controller.close() } catch { /* */ }
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
