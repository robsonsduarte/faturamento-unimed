import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guiaImportarSchema } from '@/lib/validations/guia'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const body = await request.json() as unknown
    const parsed = guiaImportarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }, { status: 400 })
    }

    // Integra com SAW API (puppeteer-api)
    const sawApiUrl = process.env.SAW_API_URL
    if (!sawApiUrl) {
      return NextResponse.json({ imported: 0, errors: ['SAW_API_URL nao configurada'] })
    }

    try {
      const sawResponse = await fetch(`${sawApiUrl}/coletar-guias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(60000),
      })

      if (!sawResponse.ok) {
        return NextResponse.json({ imported: 0, errors: ['Erro na API SAW'] })
      }

      const sawData = await sawResponse.json() as { guias: Record<string, unknown>[] }
      const guias = sawData.guias ?? []
      let imported = 0
      const errors: string[] = []

      for (const guia of guias) {
        const { error } = await supabase.from('guias').upsert(
          { ...guia, updated_at: new Date().toISOString() },
          { onConflict: 'guide_number' }
        )
        if (error) errors.push(String(guia['guide_number'] ?? '') + ': ' + error.message)
        else imported++
      }

      return NextResponse.json({ imported, errors })
    } catch {
      return NextResponse.json({ imported: 0, errors: ['Timeout ou erro de conexao com SAW'] })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
