import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const db = getServiceClient()

    // Busca sessao do usuario autenticado
    const { data: session, error: sessionError } = await db
      .from('saw_sessions')
      .select('id, cookies, expires_at, created_at')
      .eq('user_id', user.id)
      .eq('valida', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ ativa: false, sessao: null })
    }

    // Busca credenciais do usuario
    const { data: sawCred } = await db
      .from('saw_credentials')
      .select('usuario, login_url, ativo')
      .eq('user_id', user.id)
      .single()

    // Validate session in SAW portal
    const cookies = session.cookies as SawCookie[]
    const sessionValid = await getSawClient().validateSession(user.id, cookies)

    if (!sessionValid) {
      await db
        .from('saw_sessions')
        .update({ valida: false })
        .eq('id', session.id)

      return NextResponse.json({ ativa: false, sessao: null })
    }

    return NextResponse.json({
      ativa: true,
      sessao: {
        id: session.id,
        expires_at: session.expires_at,
        created_at: session.created_at,
      },
      credenciais: {
        configurada: !!sawCred,
        ativo: sawCred?.ativo ?? false,
        usuario: sawCred?.usuario ?? null,
        login_url: sawCred?.login_url ?? null,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
