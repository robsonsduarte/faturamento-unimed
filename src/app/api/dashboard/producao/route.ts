import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth
    const { searchParams } = new URL(request.url)
    const ano = searchParams.get('ano') ?? new Date().getFullYear().toString()

    const { data, error } = await supabase
      .from('guias')
      .select('status, valor_total, mes_referencia')
      .gte('mes_referencia', `${ano}-01`)
      .lte('mes_referencia', `${ano}-12`)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Agrupar por mes
    const byMonth: Record<number, { count: number; valor: number }> = {}
    for (let m = 1; m <= 12; m++) byMonth[m] = { count: 0, valor: 0 }

    for (const guia of data ?? []) {
      const mes = parseInt(guia.mes_referencia.split('-')[1], 10)
      byMonth[mes].count++
      byMonth[mes].valor += guia.valor_total ?? 0
    }

    return NextResponse.json({ ano, byMonth })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
