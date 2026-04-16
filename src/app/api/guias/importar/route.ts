import { NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials, CproConfig } from '@/lib/types'
import { importarGuia } from '@/lib/services/importar-guia'

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
      // Padding + heartbeat para destravar buffering de CF Tunnel (POST nao e auto-detectado como SSE)
      controller.enqueue(enc.encode(':' + ' '.repeat(8192) + '\n\n'))
      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`: hb${' '.repeat(2048)}\n\n`)) } catch { /* closed */ }
      }, 1000)
      const send = async (type: string, message: string, guide_number?: string, extra?: Record<string, unknown>) => {
        controller.enqueue(enc.encode(sseEvent(type, message, guide_number, extra)))
        await new Promise<void>((r) => setImmediate(r))
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
        await send('info', 'Iniciando importacao...')

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
          await send('info', 'Credenciais per-user nao encontradas. Usando config global...')
          const { data: sawInteg, error: sawIntegErr } = await db
            .from('integracoes')
            .select('config, ativo')
            .eq('slug', 'saw')
            .single()

          if (sawIntegErr || !sawInteg?.ativo) {
            await send('error', 'Credenciais SAW nao configuradas. Acesse Configuracoes > Credenciais SAW ou Integracoes.')
            controller.close()
            return
          }

          const globalConfig = sawInteg.config as Record<string, string>
          if (!globalConfig.usuario || !globalConfig.senha || !globalConfig.login_url) {
            await send('error', 'Config SAW global incompleta: usuario, senha e login_url sao obrigatorios.')
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
        await send('processing', 'Verificando sessao SAW...')

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
          await send('processing', 'Validando sessao salva no SAW...')
          const valid = await getSawClient().validateSession(user.id, sessionCookies)
          if (!valid) {
            await send('info', 'Sessao salva expirou no SAW. Fazendo novo login...')
            sessionCookies = null
            await db
              .from('saw_sessions')
              .update({ valida: false })
              .eq('user_id', user.id)
              .eq('valida', true)
          }
        }

        if (!sessionCookies) {
          await send('processing', 'Fazendo login no SAW...')

          const loginResult = await getSawClient().login(user.id, {
            login_url: sawCredentials.login_url,
            usuario: sawCredentials.usuario,
            senha: sawCredentials.senha,
          })

          if (!loginResult.success) {
            await send('error', `Falha ao autenticar no SAW: ${loginResult.error ?? 'Verifique as credenciais.'}`)
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

          await send('success', 'Login no SAW realizado com sucesso.')
        } else {
          await send('success', 'Sessao SAW validada e ativa.')
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
            await send('info', 'Reconexao realizada. Refazendo login no SAW...')

            const loginResult = await getSawClient().login(user.id, {
              login_url: sawCredentials.login_url,
              usuario: sawCredentials.usuario,
              senha: sawCredentials.senha,
            })

            if (!loginResult.success) {
              await send('error', `Re-login SAW falhou: ${loginResult.error ?? 'Verifique as credenciais.'}`)
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

            await send('success', 'Re-login SAW realizado com sucesso. Retomando importacao...')
            return true
          } catch (reconnErr) {
            const reconnMsg = reconnErr instanceof Error ? reconnErr.message : 'Erro desconhecido'
            await send('error', `Falha ao reconectar/re-login: ${reconnMsg}`)
            return false
          }
        }

        await send('info', `Processando ${total} guia(s)...`)

        // Track per-guide outer retry count to prevent infinite loops
        const outerRetryCount = new Map<number, number>()

        for (let i = 0; i < guideNumbers.length; i++) {
          const guideNumber = guideNumbers[i]
          await send('processing', `[${i + 1}/${total}] Buscando guia ${guideNumber} no SAW...`, guideNumber)

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
              await send('info', `Guia ${guideNumber}: SAW retornou ${realizados} realizados, ${detalhes} detalhes extraidos`, guideNumber)

              if (realizados > 0 && detalhes === 0) {
                await send('error', `Guia ${guideNumber}: ALERTA — ${realizados} procedimentos no SAW mas 0 extraidos. Estrutura HTML pode ter mudado.`, guideNumber)
              }

              break
            }

            const msg = sawResult.error ?? 'Erro desconhecido'

            if (isSessionError(msg) && attempt < MAX_RETRIES) {
              await send('info', `Guia ${guideNumber}: sessao fechada (${msg}). Reconectando... (tentativa ${attempt + 1}/${MAX_RETRIES})`, guideNumber)
              await sleep(RETRY_DELAY_MS)

              const reloginOk = await reloginSaw()
              if (!reloginOk) {
                await send('error', `Guia ${guideNumber}: falha ao reconectar (tentativa ${attempt + 1}/${MAX_RETRIES}).`, guideNumber)
                if (attempt === MAX_RETRIES - 1) {
                  errorCount++
                  break
                }
              }
              continue
            }

            // Network/timeout errors: aguarda 30s e retenta sem relogin
            if (isNetworkError(msg) && attempt < MAX_RETRIES) {
              await send('info', `Guia ${guideNumber}: erro de rede/timeout (${msg}). Aguardando 30s... (tentativa ${attempt + 1}/${MAX_RETRIES})`, guideNumber)
              await sleep(NETWORK_RETRY_DELAY_MS)
              continue
            }

            await send('error', `Guia ${guideNumber} falhou no SAW: ${msg}`, guideNumber)
            errorCount++
            break
          }

          if (!sawSuccess) continue

          // Delegar logica core para funcao compartilhada
          // saw_login so e setado quando body.emission_form_data esta presente (= pipeline
          // de emissao via /api/guias/emitir). Importacoes passivas nao conhecem o criador
          // original. O guard em importarGuia tambem impede sobrescrita de valor ja existente.
          const isEmission = !!body.emission_form_data
          const result = await importarGuia({
            sawData: sawData!,
            guideNumber,
            cproConfig: cproConfig ? { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' } : null,
            skipCpro: body.skip_cpro,
            mesReferencia: mesReferencia ?? null,
            emissionFormData: body.emission_form_data ?? null,
            sawLogin: isEmission ? sawCredentials.usuario : undefined,
            log: async (type, message) => { await send(type, message, guideNumber) },
          })

          if (result.success) {
            successCount++
          } else {
            await send('error', `Guia ${guideNumber} falhou: ${result.error}`, guideNumber)
            errorCount++
          }
        } catch (guiaErr) {
          // Per-guide safety net — any unexpected error skips this guide, does NOT kill the loop
          const guiaMsg = guiaErr instanceof Error ? guiaErr.message : 'Erro inesperado'

          const retries = outerRetryCount.get(i) ?? 0

          if (isSessionError(guiaMsg) && retries < MAX_RETRIES) {
            outerRetryCount.set(i, retries + 1)
            await send('info', `Guia ${guideNumber}: erro de sessao durante processamento (${guiaMsg}). Reconectando... (recuperacao ${retries + 1}/${MAX_RETRIES})`, guideNumber)
            await sleep(RETRY_DELAY_MS)
            const recovered = await reloginSaw()
            if (recovered) {
              i--
              continue
            }
          }

          if (isNetworkError(guiaMsg) && retries < MAX_RETRIES) {
            outerRetryCount.set(i, retries + 1)
            await send('info', `Guia ${guideNumber}: erro de rede/timeout (${guiaMsg}). Aguardando 30s... (recuperacao ${retries + 1}/${MAX_RETRIES})`, guideNumber)
            await sleep(NETWORK_RETRY_DELAY_MS)
            i--
            continue
          }

          await send('error', `Guia ${guideNumber}: erro inesperado (${guiaMsg}) — pulando para proxima guia`, guideNumber)
          errorCount++
        }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        await send(
          successCount === total ? 'success' : errorCount === total ? 'error' : 'info',
          `Concluido: ${successCount}/${total} guias importadas em ${elapsed}s`
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro inesperado'
        controller.enqueue(enc.encode(sseEvent('error', `Erro fatal: ${msg}`)))
      } finally {
        clearTimeout(streamTimeout)
        clearInterval(heartbeat)
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
