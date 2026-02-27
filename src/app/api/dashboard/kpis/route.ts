import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes')

    let guiasQuery = supabase.from('guias').select('status, valor_total')
    let lotesQuery = supabase.from('lotes').select('status').in('status', ['rascunho', 'gerado', 'enviado'])
    let cobrancasQuery = supabase.from('cobrancas').select('valor_pago, valor_glosado, valor_cobrado')

    if (mes && mes !== 'todos') {
      const startDate = `${mes}-01`
      const [year, month] = mes.split('-').map(Number)
      const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
      const endDate = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
      guiasQuery = guiasQuery.gte('data_solicitacao', startDate).lt('data_solicitacao', endDate)
      lotesQuery = lotesQuery.eq('referencia', mes)
      cobrancasQuery = cobrancasQuery.gte('data_cobranca', startDate).lt('data_cobranca', endDate)
    }

    const [guiasResult, lotesResult, cobrancasResult] = await Promise.all([
      guiasQuery,
      lotesQuery,
      cobrancasQuery,
    ])

    if (guiasResult.error) return NextResponse.json({ error: guiasResult.error.message }, { status: 400 })
    if (lotesResult.error) return NextResponse.json({ error: lotesResult.error.message }, { status: 400 })
    if (cobrancasResult.error) return NextResponse.json({ error: cobrancasResult.error.message }, { status: 400 })

    const guias = guiasResult.data ?? []
    const cobrancas = cobrancasResult.data ?? []

    return NextResponse.json({
      total_guias: guias.length,
      guias_pendentes: guias.filter((g) => g.status === 'PENDENTE').length,
      guias_cpro: guias.filter((g) => g.status === 'CPRO').length,
      guias_token: guias.filter((g) => g.status === 'TOKEN').length,
      guias_completas: guias.filter((g) => g.status === 'COMPLETA').length,
      guias_processadas: guias.filter((g) => g.status === 'PROCESSADA').length,
      guias_faturadas: guias.filter((g) => g.status === 'FATURADA').length,
      valor_total_guias: guias.reduce((a, g) => a + (g.valor_total ?? 0), 0),
      valor_completas: guias
        .filter((g) => g.status === 'COMPLETA')
        .reduce((a, g) => a + (g.valor_total ?? 0), 0),
      valor_processado: guias
        .filter((g) => g.status === 'PROCESSADA')
        .reduce((a, g) => a + (g.valor_total ?? 0), 0),
      valor_total_faturado: guias.filter((g) => g.status === 'FATURADA').reduce((a, g) => a + (g.valor_total ?? 0), 0),
      valor_total_pago: cobrancas.reduce((a, c) => a + (c.valor_pago ?? 0), 0),
      valor_total_glosado: cobrancas.reduce((a, c) => a + (c.valor_glosado ?? 0), 0),
      lotes_abertos: lotesResult.data?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
