import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'

/** Service role client — bypasses RLS for trusted server-side DB operations */
function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function timestamp(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false })
}

function sseEvent(type: string, message: string): string {
  return `data: ${JSON.stringify({ type, message, timestamp: timestamp() })}\n\n`
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'guias-emitir', 10, 60_000)
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
    carteira?: string
    profissional?: { nome: string; conselho: string; numeroConselho: string; uf: string; cbo: string }
    procedimento_codigo?: string
    quantidade?: number
    indicacao_clinica?: string
  }

  // Validate required fields
  if (!body.carteira || !body.profissional?.nome || !body.procedimento_codigo || !body.quantidade) {
    return new Response(
      JSON.stringify({ error: 'Campos obrigatorios: carteira, profissional.nome, procedimento_codigo, quantidade' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (type: string, message: string) => {
        controller.enqueue(enc.encode(sseEvent(type, message)))
      }

      const streamTimeout = setTimeout(() => {
        try {
          controller.enqueue(enc.encode(sseEvent('error', 'Timeout: operacao excedeu 5 minutos')))
          controller.close()
        } catch { /* already closed */ }
      }, 5 * 60 * 1000)

      const db = getServiceClient()

      try {
        send('processing', 'Iniciando emissao de guia...')

        // ─── Credenciais SAW ─────────────────────────────────────
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

        // ─── Sessao SAW ──────────────────────────────────────────
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

        // ─── Emitir guia ─────────────────────────────────────────
        send('processing', `Emitindo guia — carteira ${body.carteira}, profissional ${body.profissional!.nome}...`)

        const result = await getSawClient().createGuide(
          user.id,
          sessionCookies,
          {
            carteira: body.carteira!,
            profissional: body.profissional!,
            procedimentoCodigo: body.procedimento_codigo!,
            quantidade: body.quantidade!,
            indicacaoClinica: body.indicacao_clinica || undefined,
          },
          (step, msg) => send('processing', `[${step}] ${msg}`),
        )

        if (!result.success) {
          send('error', result.error ?? 'Falha ao emitir guia no SAW.')
          controller.close()
          return
        }

        // ─── Sucesso ─────────────────────────────────────────────
        const guideLabel = result.guideNumber ? `guia ${result.guideNumber}` : 'guia emitida (numero nao extraido)'
        const pacienteLabel = result.paciente ? ` — paciente: ${result.paciente.split(' ')[0]}` : ''
        send('success', `${guideLabel}${pacienteLabel} criada com sucesso.`)

        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({
              type: 'result',
              guideNumber: result.guideNumber ?? null,
              paciente: result.paciente ?? null,
              formData: result.formData ?? null,
              timestamp: timestamp(),
            })}\n\n`,
          ),
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro inesperado'
        controller.enqueue(enc.encode(sseEvent('error', `Erro fatal: ${msg}`)))
      } finally {
        clearTimeout(streamTimeout)
        try { controller.close() } catch { /* already closed */ }
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
