import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireRole, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'

// Aumentar timeout da rota (Playwright precisa de tempo)
export const maxDuration = 120

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/biometria/iniciar-token
 * Opens the SAW token page for a guide and returns available methods/phones.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'biometria-iniciar', 10, 60_000)
    if (limited) return limited

    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const body = await request.json() as { guia_id?: string }
    if (!body.guia_id) {
      return NextResponse.json({ error: 'guia_id obrigatorio' }, { status: 400 })
    }

    const db = getServiceClient()

    const { data: guia } = await db
      .from('guias')
      .select('id, guide_number, paciente, numero_carteira')
      .eq('id', body.guia_id)
      .single()

    if (!guia) {
      return NextResponse.json({ error: 'Guia nao encontrada' }, { status: 404 })
    }

    // Buscar credenciais SAW
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
      if (!integ?.ativo) return NextResponse.json({ error: 'Credenciais SAW nao configuradas' }, { status: 400 })
      const cfg = integ.config as Record<string, string>
      loginUrl = cfg.login_url; usuario = cfg.usuario; senha = cfg.senha
    }

    // Buscar sessao existente (sem validar — openTokenPage detecta se expirou)
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

    // Se nao tem sessao, faz login primeiro
    if (!cookies) {
      console.log(`[INICIAR-TOKEN] Sem sessao, fazendo login...`)
      const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
      if (!loginResult.success) {
        return NextResponse.json({ error: `Login SAW falhou: ${loginResult.error}` }, { status: 502 })
      }
      cookies = loginResult.cookies
      await db.from('saw_sessions').insert({
        user_id: user.id, cookies, valida: true,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
    }

    // Abrir pagina de token
    console.log(`[INICIAR-TOKEN] Abrindo token page para guia ${guia.guide_number}...`)
    let result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number)

    // Se sessao expirou, refazer login e tentar de novo
    if (!result.success && result.error?.includes('expirou')) {
      console.log(`[INICIAR-TOKEN] Sessao expirou, refazendo login...`)
      await db.from('saw_sessions').update({ valida: false }).eq('user_id', user.id).eq('valida', true)
      const loginResult = await getSawClient().login(user.id, { login_url: loginUrl, usuario, senha })
      if (!loginResult.success) {
        return NextResponse.json({ error: `Re-login SAW falhou: ${loginResult.error}` }, { status: 502 })
      }
      cookies = loginResult.cookies
      await db.from('saw_sessions').insert({
        user_id: user.id, cookies, valida: true,
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
      result = await getSawClient().openTokenPage(user.id, cookies, guia.guide_number)
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      guideNumber: guia.guide_number,
      paciente: guia.paciente,
      methods: result.methods,
      phones: result.phones,
    })
  } catch (err) {
    console.error('[INICIAR-TOKEN] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
