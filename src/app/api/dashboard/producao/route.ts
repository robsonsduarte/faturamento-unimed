import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get('ano') ?? new Date().getFullYear().toString()

    const { data, error } = await supabase
      .from('guias')
      .select('status, valor_total, created_at')
      .gte('created_at', `${ano}-01-01`)
      .lte('created_at', `${ano}-12-31`)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Agrupar por mes
    const byMonth: Record<number, { count: number; valor: number }> = {}
    for (let m = 1; m <= 12; m++) byMonth[m] = { count: 0, valor: 0 }

    for (const guia of data ?? []) {
      const mes = new Date(guia.created_at).getMonth() + 1
      byMonth[mes].count++
      byMonth[mes].valor += guia.valor_total ?? 0
    }

    return NextResponse.json({ ano, byMonth })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
