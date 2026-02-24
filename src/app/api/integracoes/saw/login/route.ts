import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const sawApiUrl = process.env.SAW_API_URL
    if (!sawApiUrl) return NextResponse.json({ error: 'SAW_API_URL nao configurada' }, { status: 500 })

    const res = await fetch(`${sawApiUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) return NextResponse.json({ error: 'Erro no login SAW' }, { status: 502 })

    const data = await res.json() as { cookies: Record<string, string> }

    await supabase.from('saw_sessions').insert({
      cookies: data.cookies,
      valida: true,
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
