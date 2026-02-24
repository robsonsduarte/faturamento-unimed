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

    const body = await request.json() as { guide_number: string }

    const res = await fetch(`${sawApiUrl}/ler-guia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) return NextResponse.json({ error: 'Erro ao ler guia do SAW' }, { status: 502 })

    const data = await res.json() as Record<string, unknown>
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
