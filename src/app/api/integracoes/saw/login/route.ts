import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireRole, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit'
import { getSawClient } from '@/lib/saw/client'
import type { SawCredentials } from '@/lib/types'  

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'saw-login', 5, 60_000)
    if (limited) return limited

    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { user, supabase } = auth

    const db = getServiceClient()

    // Busca credenciais SAW: per-user primeiro, fallback global
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
      const { data: integ } = await supabase
        .from('integracoes')
        .select('config, ativo')
        .eq('slug', 'saw')
        .single()

      if (!integ?.ativo) {
        return NextResponse.json({ error: 'Credenciais SAW nao configuradas.' }, { status: 400 })
      }
      const cfg = integ.config as Record<string, string>
      if (!cfg.usuario || !cfg.senha || !cfg.login_url) {
        return NextResponse.json({ error: 'Config SAW incompleta.' }, { status: 400 })
      }
      loginUrl = cfg.login_url
      usuario = cfg.usuario
      senha = cfg.senha
    }

    const result = await getSawClient().login(user.id, {
      login_url: loginUrl,
      usuario,
      senha,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Falha no login SAW' },
        { status: 502 }
      )
    }

    // Invalida sessoes anteriores do usuario
    await db
      .from('saw_sessions')
      .update({ valida: false })
      .eq('user_id', user.id)
      .eq('valida', true)

    const { data: session } = await db.from('saw_sessions').insert({
      user_id: user.id,
      cookies: result.cookies,
      valida: true,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }).select('id').single()

    await auditLog(supabase, user.id, 'saw.login', 'saw_session', session?.id ?? 'unknown', {}, request)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
