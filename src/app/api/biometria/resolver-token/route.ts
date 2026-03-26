import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireRole, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { resolverTokenSchema } from '@/lib/validations/biometria'
import { buscarFotoBase64 } from '@/lib/services/biometria'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function sseEvent(type: string, message: string): string {
  return `data: ${JSON.stringify({ type, message, timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }) })}\n\n`
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, 'biometria-resolver', 5, 60_000)
  if (limited) return limited

  const auth = await requireRole(['admin', 'operador'])
  if (isAuthError(auth)) {
    return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { user } = auth

  const body = await request.json().catch(() => ({})) as unknown
  const parsed = resolverTokenSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
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
          send('error', 'Timeout: resolucao excedeu 5 minutos')
          controller.close()
        } catch { /* already closed */ }
      }, 5 * 60 * 1000)

      const db = getServiceClient()

      try {
        // Buscar guia
        send('processing', 'Buscando dados da guia...')
        const { data: guia, error: guiaErr } = await db
          .from('guias')
          .select('id, guide_number, paciente, numero_carteira')
          .eq('id', parsed.data.guia_id)
          .single()

        if (guiaErr || !guia) {
          send('error', 'Guia nao encontrada')
          controller.close()
          return
        }

        if (!guia.numero_carteira) {
          send('error', 'Guia sem numero de carteira')
          controller.close()
          return
        }

        // Buscar foto do paciente
        send('processing', 'Buscando foto do paciente...')
        const photoBase64 = await buscarFotoBase64(guia.numero_carteira)

        if (!photoBase64) {
          send('error', 'Foto do paciente nao encontrada. Capture a foto primeiro.')
          controller.close()
          return
        }

        send('success', `Foto encontrada para ${guia.paciente?.split(' ')[0] ?? 'paciente'}`)

        // Buscar credenciais SAW do usuario
        send('processing', 'Verificando sessao SAW...')
        const { data: sawCred } = await db
          .from('saw_credentials')
          .select('*')
          .eq('user_id', user.id)
          .eq('ativo', true)
          .single()

        let loginUrl: string
        let usuario: string
        let senha: string

        if (sawCred) {
          const cred = sawCred as SawCredentials
          loginUrl = cred.login_url
          usuario = cred.usuario
          senha = cred.senha
        } else {
          const { data: integ } = await db
            .from('integracoes')
            .select('config, ativo')
            .eq('slug', 'saw')
            .single()

          if (!integ?.ativo) {
            send('error', 'Credenciais SAW nao configuradas.')
            controller.close()
            return
          }
          const cfg = integ.config as Record<string, string>
          loginUrl = cfg.login_url
          usuario = cfg.usuario
          senha = cfg.senha
        }

        // Verificar/criar sessao SAW
        const { data: existingSession } = await db
          .from('saw_sessions')
          .select('cookies')
          .eq('user_id', user.id)
          .eq('valida', true)
          .gte('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let cookies: SawCookie[] | null = existingSession?.cookies
          ? (existingSession.cookies as SawCookie[])
          : null

        if (cookies) {
          const valid = await getSawClient().validateSession(user.id, cookies)
          if (!valid) {
            send('info', 'Sessao expirou. Refazendo login...')
            cookies = null
            await db.from('saw_sessions').update({ valida: false }).eq('user_id', user.id).eq('valida', true)
          }
        }

        if (!cookies) {
          send('processing', 'Fazendo login no SAW...')
          const loginResult = await getSawClient().login(user.id, {
            login_url: loginUrl,
            usuario,
            senha,
          })

          if (!loginResult.success) {
            send('error', `Login SAW falhou: ${loginResult.error}`)
            controller.close()
            return
          }

          cookies = loginResult.cookies
          await db.from('saw_sessions').insert({
            user_id: user.id,
            cookies,
            valida: true,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          })

          send('success', 'Login SAW realizado.')
        } else {
          send('success', 'Sessao SAW ativa.')
        }

        // Resolver token via Playwright
        send('processing', `Resolvendo token da guia ${guia.guide_number}...`)
        const result = await getSawClient().resolveToken(
          user.id,
          cookies,
          guia.guide_number,
          photoBase64
        )

        if (!result.success) {
          send('error', `Falha ao resolver token: ${result.error}`)
          controller.close()
          return
        }

        send('success', 'Token resolvido com sucesso! Biometria autenticada.')

        // Marcar guia
        await db
          .from('guias')
          .update({
            token_biometrico: true,
            data_token: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', guia.id)

        // Reimportar guia automaticamente
        send('processing', 'Reimportando guia...')
        const readResult = await getSawClient().readGuide(user.id, cookies, guia.guide_number)

        if (readResult.success) {
          send('success', 'Guia reimportada. Status sera atualizado.')
        } else {
          send('info', `Reimportacao falhou (${readResult.error}). Reimporte manualmente.`)
        }

        send('success', 'Processo concluido!')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro inesperado'
        send('error', `Erro fatal: ${msg}`)
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
