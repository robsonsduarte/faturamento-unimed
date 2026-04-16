import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
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

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

/**
 * POST /api/biometria/token-metodo
 * SSE — Abre guia no SAW, seleciona metodo (App/SMS), retorna dados.
 * Para SMS: retorna telefones para operador escolher.
 * Para App: envia WhatsApp automaticamente.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'token-metodo', 10, 60_000)
  if (limited) return limited

  const auth = await requireAuth()
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  const { user } = auth

  const body = await request.json().catch(() => ({})) as {
    guia_id?: string
    method?: 'aplicativo' | 'sms'
  }

  if (!body.guia_id || !body.method) {
    return new Response(JSON.stringify({ error: 'guia_id e method obrigatorios' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      controller.enqueue(enc.encode(':' + ' '.repeat(8192) + '\n\n'))
      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`: hb${' '.repeat(2048)}\n\n`)) } catch { /* closed */ }
      }, 1000)
      const send = async (data: Record<string, unknown>) => {
        controller.enqueue(enc.encode(':' + ' '.repeat(2048) + '\n\n' + sseEvent(data)))
        await new Promise<void>((r) => setImmediate(r))
      }

      const timeout = setTimeout(() => {
        try {
          controller.enqueue(enc.encode(':' + ' '.repeat(2048) + '\n\n' + sseEvent({ type: 'error', message: 'Timeout' })))
          controller.close()
        } catch { /**/ }
      }, 2 * 60 * 1000)

      const db = getServiceClient()

      try {
        // 1. Buscar guia
        await send({ type: 'processing', message: 'Buscando dados da guia...' })
        const { data: guia } = await db.from('guias').select('id, guide_number, paciente, numero_carteira').eq('id', body.guia_id).single()
        if (!guia) { await send({ type: 'error', message: 'Guia nao encontrada' }); controller.close(); return }

        // 2. Login SAW
        await send({ type: 'processing', message: 'Verificando sessao SAW...' })
        const { data: sawCred } = await db.from('saw_credentials').select('*').eq('user_id', user.id).eq('ativo', true).single()

        let loginUrl: string, usuario: string, senha: string
        if (sawCred) {
          const c = sawCred as SawCredentials; loginUrl = c.login_url; usuario = c.usuario; senha = c.senha
        } else {
          const { data: integ } = await db.from('integracoes').select('config, ativo').eq('slug', 'saw').single()
          if (!integ?.ativo) { await send({ type: 'error', message: 'Credenciais SAW nao configuradas' }); controller.close(); return }
          const cfg = integ.config as Record<string, string>; loginUrl = cfg.login_url; usuario = cfg.usuario; senha = cfg.senha
        }

        const { data: session } = await db.from('saw_sessions').select('cookies').eq('user_id', user.id).eq('valida', true)
          .gte('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).single()
        let cookies: SawCookie[] | null = session?.cookies as SawCookie[] | null

        if (!cookies) {
          await send({ type: 'processing', message: 'Fazendo login no SAW...' })
          const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!loginResult.success) { await send({ type: 'error', message: `Login falhou: ${loginResult.error}` }); controller.close(); return }
          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({ user_id: user.id, cookies, valida: true, expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() })
          await send({ type: 'success', message: 'Login SAW realizado.' })
        } else {
          await send({ type: 'success', message: 'Sessao SAW ativa.' })
        }

        // 2.5 Buscar data de nascimento do paciente (para justificativa BioFace)
        let dataNascimento: string | undefined
        try {
          const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
          if (cproInteg?.ativo) {
            const cfg = cproInteg.config as Record<string, string>
            const cproUrl = `${cfg.api_url}/service/api/v1/executions/by-guide-number/${guia.guide_number}?company=${cfg.company ?? '1'}`
            const cproBody = await new Promise<string>((resolve) => {
              const parsed = new URL(cproUrl)
              const req = https.request({
                hostname: parsed.hostname, port: parsed.port || 443,
                path: parsed.pathname + parsed.search, method: 'GET',
                headers: { 'X-API-Key': cfg.api_key, Host: 'consultoriopro.com.br', Accept: 'application/json' },
                rejectUnauthorized: false, timeout: 10000,
              }, (res) => { let d = ''; res.on('data', (c: Buffer) => { d += c.toString() }); res.on('end', () => resolve(d)) })
              req.on('error', () => resolve('')); req.on('timeout', () => { req.destroy(); resolve('') }); req.end()
            })
            if (cproBody) {
              const cproJson = JSON.parse(cproBody)
              dataNascimento = cproJson?.data?.patient?.born_at ?? undefined
            }
          }
        } catch { /* */ }

        // 3. Abrir pagina de token (com retry se sessao expirou)
        await send({ type: 'processing', message: 'Abrindo guia no SAW...' })
        let result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number, dataNascimento)

        // Se sessao expirou, refazer login e tentar de novo
        if (!result.success && result.error?.includes('expirou')) {
          await send({ type: 'processing', message: 'Sessao expirou. Refazendo login...' })
          await db.from('saw_sessions').update({ valida: false }).eq('user_id', user.id).eq('valida', true)
          const relogin = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
          if (!relogin.success) { await send({ type: 'error', message: `Re-login falhou: ${relogin.error}` }); controller.close(); return }
          cookies = relogin.cookies
          await db.from('saw_sessions').insert({ user_id: user.id, cookies, valida: true, expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() })
          await send({ type: 'success', message: 'Re-login realizado.' })

          result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number, dataNascimento)
        }

        if (!result.success) {
          if (result.tokenAlreadyResolved) {
            await send({ type: 'result', success: true, tokenAlreadyResolved: true })
            controller.close(); return
          }
          await send({ type: 'error', message: result.error ?? 'Erro ao abrir token' }); controller.close(); return
        }

        if (body.method === 'sms') {
          // 4a. SMS: NÃO chamar selectTokenMethod ainda (seria chamado pelo frontend depois)
          // Apenas extrair telefones da page que openTokenPage já abriu
          // openTokenPage já clicou radio SMS para revelar o select, extraiu, e voltou para Aplicativo
          // Precisamos clicar SMS de novo e extrair

          await send({ type: 'processing', message: 'Selecionando SMS no SAW...' })

          // Clicar radio SMS pelo texto (nao por posicao fixa — a ordem pode mudar)
          const entry = getSawClient().getTokenSession(result.sessionId!)
          if (entry) {
            try {
              await entry.page.evaluate(() => {
                const radios = document.querySelectorAll('input[type="radio"]')
                for (const radio of radios) {
                  const parent = radio.closest('td, div, label')
                  if (parent && /sms/i.test(parent.textContent ?? '')) {
                    (radio as HTMLInputElement).click()
                    break
                  }
                }
              })
            } catch { /* */ }
            // Esperar select de telefones aparecer (SAW pode demorar)
            for (let i = 0; i < 5; i++) {
              await new Promise((r) => setTimeout(r, 1500))
              const hasSelect = await entry.page.evaluate(() => {
                const sel = document.getElementById('tokenDeAtendimento.telefoneDeEnvio.numero')
                  ?? document.querySelector('select[name*="telefoneDeEnvio"]')
                return sel ? (sel as HTMLSelectElement).options.length > 1 : false
              }).catch(() => false)
              if (hasSelect) break
            }
          }

          await send({ type: 'processing', message: 'Extraindo telefones do SAW...' })
          const smsPhones = await getSawClient().getTokenPagePhones(result.sessionId!)

          // Buscar telefone WhatsApp do CPro
          let patientPhone = ''
          try {
            const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
            if (cproInteg?.ativo) {
              const cfg = cproInteg.config as Record<string, string>
              const cproUrl = `${cfg.api_url}/service/api/v1/executions/by-guide-number/${guia.guide_number}?company=${cfg.company ?? '1'}`
              const cproBody = await new Promise<string>((resolve) => {
                const parsed = new URL(cproUrl)
                const req = https.request({
                  hostname: parsed.hostname, port: parsed.port || 443,
                  path: parsed.pathname + parsed.search, method: 'GET',
                  headers: { 'X-API-Key': cfg.api_key, Host: 'consultoriopro.com.br', Accept: 'application/json' },
                  rejectUnauthorized: false, timeout: 10000,
                }, (res) => { let d = ''; res.on('data', (c: Buffer) => { d += c.toString() }); res.on('end', () => resolve(d)) })
                req.on('error', () => resolve('')); req.on('timeout', () => { req.destroy(); resolve('') }); req.end()
              })
              if (cproBody) {
                const mobile = JSON.parse(cproBody)?.data?.patient?.mobile as string ?? ''
                if (mobile) { patientPhone = mobile.replace(/\D/g, ''); if (!patientPhone.startsWith('55')) patientPhone = `55${patientPhone}` }
              }
            }
          } catch { /**/ }

          await send({
            type: 'result',
            method: 'sms',
            sessionId: result.sessionId,
            guideNumber: guia.guide_number,
            paciente: guia.paciente,
            phones: smsPhones,
            patientPhone,
            needsPhoneSelection: true,
          })
        } else {
          // 5b. App: selecionar Aplicativo no SAW + buscar telefone CPro + enviar WhatsApp
          await send({ type: 'processing', message: 'Selecionando Aplicativo no SAW...' })
          const methodResult = await getSawClient().selectTokenMethod(result.sessionId!, 'aplicativo')
          if (!methodResult.success) {
            await send({ type: 'error', message: methodResult.error ?? 'Erro ao selecionar Aplicativo' }); controller.close(); return
          }

          await send({ type: 'processing', message: 'Buscando telefone do paciente...' })

          let patientPhone = ''
          try {
            const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
            if (cproInteg?.ativo) {
              const cfg = cproInteg.config as Record<string, string>
              const cproUrl = `${cfg.api_url}/service/api/v1/executions/by-guide-number/${guia.guide_number}?company=${cfg.company ?? '1'}`
              const cproBody = await new Promise<string>((resolve) => {
                const parsed = new URL(cproUrl)
                const req = https.request({
                  hostname: parsed.hostname, port: parsed.port || 443,
                  path: parsed.pathname + parsed.search, method: 'GET',
                  headers: { 'X-API-Key': cfg.api_key, Host: 'consultoriopro.com.br', Accept: 'application/json' },
                  rejectUnauthorized: false, timeout: 10000,
                }, (res) => { let d = ''; res.on('data', (c: Buffer) => { d += c.toString() }); res.on('end', () => resolve(d)) })
                req.on('error', () => resolve('')); req.on('timeout', () => { req.destroy(); resolve('') }); req.end()
              })
              if (cproBody) {
                const mobile = JSON.parse(cproBody)?.data?.patient?.mobile as string ?? ''
                if (mobile) { patientPhone = mobile.replace(/\D/g, ''); if (!patientPhone.startsWith('55')) patientPhone = `55${patientPhone}` }
              }
            }
          } catch { /**/ }

          // Enviar WhatsApp
          let whatsappSent = false
          let requestId = ''
          if (patientPhone) {
            await send({ type: 'processing', message: `Enviando WhatsApp para ${patientPhone.replace(/^55(\d{2})(\d+)/, '($1) $2')}...` })
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
                  method: 'POST', headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
                  body: JSON.stringify({ number: `${patientPhone}@s.whatsapp.net`, text: msg }),
                })
                whatsappSent = wRes.ok
              } catch { /**/ }

              if (whatsappSent) {
                try {
                  const { data: req } = await db.from('token_requests').insert({
                    guia_id: guia.id, guide_number: guia.guide_number, paciente_nome: guia.paciente ?? '',
                    phone_whatsapp: patientPhone, method: 'aplicativo', session_id: result.sessionId!,
                    status: 'waiting', expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), created_by: user.id,
                  }).select('id').single()
                  requestId = req?.id ?? ''
                } catch { /**/ }
              }
            }
          }

          await send({
            type: 'result',
            method: 'aplicativo',
            sessionId: result.sessionId,
            guideNumber: guia.guide_number,
            paciente: guia.paciente,
            patientPhone,
            whatsappSent,
            requestId,
          })
        }
      } catch (err) {
        await send({ type: 'error', message: err instanceof Error ? err.message : 'Erro interno' })
      } finally {
        clearTimeout(timeout)
        clearInterval(heartbeat)
        try { controller.close() } catch { /**/ }
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  })
}
