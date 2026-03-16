import { NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'
import type { SawConfig } from '@/lib/types'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth

    const { data: session, error: sessionError } = await supabase
      .from('saw_sessions')
      .select('id, cookies, expires_at, created_at')
      .eq('valida', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ ativa: false, sessao: null })
    }

    const { data: integracao } = await supabase
      .from('integracoes')
      .select('config, ativo')
      .eq('slug', 'saw')
      .single()

    const config = integracao?.config as SawConfig | undefined

    // Validate the session is still live in the SAW portal
    const cookies = session.cookies as SawCookie[]
    const sessionValid = await getSawClient().validateSession(cookies)

    // If the portal rejected the session, mark it as invalid in the DB
    if (!sessionValid) {
      await supabase
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
      integracao: {
        ativo: integracao?.ativo ?? false,
        login_url: config?.login_url ?? null,
        usuario: config?.usuario ?? null,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
