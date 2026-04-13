import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'
import https from 'https'
import { appendFileSync } from 'fs'

function routeLog(msg: string) {
  const line = `[${new Date().toISOString()}] [iniciar-token] ${msg}\n`
  try { appendFileSync('/tmp/saw-debug.log', line) } catch { /* */ }
}

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/biometria/iniciar-token
 * SSE streaming — validates session, opens SAW token page, selects method and completes the flow.
 * Body: { guia_id: string, method: 'aplicativo' | 'sms' }
 *
 * SMS result:  { type: 'result', method: 'sms', sessionId, phones, patientPhone, needsPhoneSelection: true }
 * App result:  { type: 'result', method: 'aplicativo', sessionId, whatsappSent, requestId, patientPhone }
 * Resolved:    { type: 'result', success: true, tokenAlreadyResolved: true }
 */
export async function POST(request: NextRequest) {
  routeLog('POST chamado')
  const limited = rateLimit(request, 'biometria-iniciar', 10, 60_000)
  if (limited) { routeLog('rate limited'); return limited }

  const auth = await requireAuth()
  routeLog(`auth result: ${isAuthError(auth) ? 'ERROR' : 'OK user=' + (auth as { user: { id: string } }).user?.id?.substring(0, 8)}`)
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { user } = auth

  const body = await request.json().catch(() => ({})) as {
    guia_id?: string
    method?: 'aplicativo' | 'sms'
  }

  if (!body.guia_id || !body.method) {
    return new Response(JSON.stringify({ error: 'guia_id e method obrigatorios' }), {
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
        // 1. Buscar guia
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

        // 2. Buscar data de nascimento e telefone do CPro (uma unica chamada)
        let dataNascimento: string | undefined
        let patientPhone = ''

        try {
          const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
          if (cproInteg?.ativo) {
            const cfg = cproInteg.config as Record<string, string>
            const cproUrl = `${cfg.api_url}/service/api/v1/executions/by-guide-number/${guia.guide_number}?company=${cfg.company ?? '1'}`
            const cproBody = await new Promise<string>((resolve) => {
              const parsed = new URL(cproUrl)
              const req = https.request({
                hostname: parsed.hostname,
                port: parsed.port || 443,
                path: parsed.pathname + parsed.search,
                method: 'GET',
                headers: { 'X-API-Key': cfg.api_key, Host: 'consultoriopro.com.br', Accept: 'application/json' },
                rejectUnauthorized: false,
                timeout: 10000,
              }, (res) => {
                let d = ''
                res.on('data', (c: Buffer) => { d += c.toString() })
                res.on('end', () => resolve(d))
              })
              req.on('error', () => resolve(''))
              req.on('timeout', () => { req.destroy(); resolve('') })
              req.end()
            })
            if (cproBody) {
              const cproJson = JSON.parse(cproBody)
              dataNascimento = cproJson?.data?.patient?.born_at ?? undefined
              const mobile = cproJson?.data?.patient?.mobile as string ?? ''
              if (mobile) {
                patientPhone = mobile.replace(/\D/g, '')
                if (!patientPhone.startsWith('55')) patientPhone = `55${patientPhone}`
              }
            }
          }
        } catch {
          // CPro falhou — continua sem born_at e sem telefone
        }

        routeLog(`cpro: dataNascimento=${dataNascimento} patientPhone=${patientPhone}`)

        // 3. Buscar credenciais SAW
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

        // 4. Validar / obter sessao SAW
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

        // 5. Abrir pagina de token (openTokenPage lida com BioFace via dataNascimento)
        send({ type: 'processing', message: 'Abrindo guia no SAW...' })
        routeLog(`chamando openTokenPage guia=${guia.guide_number} method=${body.method}`)
        let result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number, dataNascimento)
        routeLog(`openTokenPage result: success=${result.success} tokenAlreadyResolved=${result.tokenAlreadyResolved} sessionId=${result.sessionId} error=${result.error}`)

        // Retry se sessao expirou
        if (!result.success && result.error?.includes('expirou')) {
          send({ type: 'processing', message: 'Sessao expirou. Refazendo login...' })
          await db.from('saw_sessions').update({ valida: false }).eq('user_id', user.id).eq('valida', true)
          const relogin = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!relogin.success) {
            send({ type: 'error', message: `Re-login falhou: ${relogin.error}` })
            controller.close()
            return
          }
          cookies = relogin.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id, cookies, valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })
          send({ type: 'success', message: 'Re-login realizado.' })
          result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number, dataNascimento)
        }

        if (!result.success) {
          send({ type: 'error', message: result.error ?? 'Erro ao abrir pagina de token' })
          controller.close()
          return
        }

        // 5.5 Se metodos nao detectados (SAW em estado "aguardando token" de tentativa anterior),
        // fechar sessao e reabrir do zero
        if (result.methods && !result.methods.aplicativo && !result.methods.sms) {
          routeLog(`methods=false/false — SAW em estado residual, reabrindo do zero`)
          send({ type: 'processing', message: 'SAW em estado anterior. Reiniciando...' })
          if (result.sessionId) await getSawClient().closeTokenSession(result.sessionId)
          result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number, dataNascimento)
          routeLog(`retry openTokenPage: success=${result.success} methods=${JSON.stringify(result.methods)} sessionId=${result.sessionId}`)

          if (!result.success) {
            send({ type: 'error', message: result.error ?? 'Erro ao reabrir token' })
            controller.close()
            return
          }
        }

        // 6. Token ja resolvido (BioFace ou outra via) — atualizar guia e finalizar
        if (result.tokenAlreadyResolved) {
          send({ type: 'success', message: 'Token ja validado! Reimportando guia...' })

          try {
            const readResult = await getSawClient().readGuide(user.id, cookies, guia.guide_number)
            if (readResult.success) {
              send({ type: 'success', message: 'Guia reimportada com sucesso.' })
            }
          } catch { /* */ }

          await db.from('guias').update({
            token_biometrico: true,
            data_token: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', guia.id)

          send({ type: 'result', success: true, tokenAlreadyResolved: true })
          controller.close()
          return
        }

        send({ type: 'success', message: 'Pagina de token aberta no SAW.' })

        // 7. Ramificar pelo metodo escolhido
        if (body.method === 'sms') {
          // SMS: clicar APENAS o radio SMS (nao o botao Enviar) e extrair telefones
          send({ type: 'processing', message: 'Selecionando SMS no SAW...' })

          const entry = getSawClient().getTokenSession(result.sessionId!)
          if (entry) {
            // Clicar radio SMS pelo texto (nao selectTokenMethod que clica Enviar)
            const clicked = await entry.page.evaluate(() => {
              const radios = document.querySelectorAll('input[type="radio"]')
              for (const radio of radios) {
                const parent = radio.closest('td, div, label')
                if (parent && /sms/i.test(parent.textContent ?? '')) {
                  (radio as HTMLInputElement).click()
                  return true
                }
              }
              return false
            }).catch(() => false)

            if (!clicked) {
              routeLog(`SMS radio nao encontrado — pagina pode estar em estado residual`)
            }

            // Esperar select de telefones aparecer (getTokenPagePhones tem retry proprio)
            await new Promise((r) => setTimeout(r, 2000))
          }

          send({ type: 'processing', message: 'Extraindo telefones do SAW...' })
          const phones = await getSawClient().getTokenPagePhones(result.sessionId!)
          routeLog(`sms phones extraidos: ${JSON.stringify(phones)}`)

          send({
            type: 'result',
            method: 'sms',
            sessionId: result.sessionId,
            phones,
            patientPhone,
            needsPhoneSelection: true,
          })
        } else {
          // APP: selecionar Aplicativo, enviar WhatsApp, criar token_request
          send({ type: 'processing', message: 'Selecionando Aplicativo no SAW...' })
          const methodResult = await getSawClient().selectTokenMethod(result.sessionId!, 'aplicativo')
          if (!methodResult.success) {
            send({ type: 'error', message: methodResult.error ?? 'Erro ao selecionar Aplicativo' })
            controller.close()
            return
          }

          let whatsappSent = false
          let requestId = ''

          if (patientPhone) {
            send({ type: 'processing', message: `Enviando WhatsApp para ${patientPhone.replace(/^55(\d{2})(\d+)/, '($1) $2')}...` })

            const evolutionUrl = process.env.EVOLUTION_API_URL ?? ''
            const evolutionKey = process.env.EVOLUTION_API_KEY ?? ''
            const instanceName = process.env.EVOLUTION_INSTANCE ?? 'Espaço Dedicare'

            if (evolutionKey) {
              const msg = [
                `Ola! Precisamos do *token de atendimento* para a guia do paciente *${guia.paciente ?? ''}*.`,
                '', 'Por favor:', '1. Abra o *aplicativo da Unimed*', '2. Acesse a *carteira digital*',
                '3. Copie o *token de 6 digitos*', '4. *Responda esta mensagem* com o token',
                '', 'O token expira em *4 minutos e 30 segundos*.', '', '_Clinica Dedicare - Faturamento_',
              ].join('\n')

              try {
                const wRes = await fetch(`${evolutionUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
                  body: JSON.stringify({ number: `${patientPhone}@s.whatsapp.net`, text: msg }),
                })
                whatsappSent = wRes.ok
                routeLog(`whatsapp enviado: ok=${whatsappSent}`)
              } catch { /* */ }

              if (whatsappSent) {
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
                  routeLog(`token_request criado: id=${requestId}`)
                } catch { /* */ }
              }
            }
          }

          send({
            type: 'result',
            method: 'aplicativo',
            sessionId: result.sessionId,
            whatsappSent,
            requestId,
            patientPhone,
          })
        }
      } catch (err) {
        routeLog(`erro: ${err instanceof Error ? err.message : String(err)}`)
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
