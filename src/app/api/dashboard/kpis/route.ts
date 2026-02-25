import { NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth

    const [guiasResult, lotesResult, cobrancasResult] = await Promise.all([
      supabase.from('guias').select('status, valor_total'),
      supabase.from('lotes').select('status').in('status', ['rascunho', 'gerado', 'enviado']),
      supabase.from('cobrancas').select('valor_pago, valor_glosado, valor_cobrado'),
    ])

    if (guiasResult.error) return NextResponse.json({ error: guiasResult.error.message }, { status: 400 })
    if (lotesResult.error) return NextResponse.json({ error: lotesResult.error.message }, { status: 400 })
    if (cobrancasResult.error) return NextResponse.json({ error: cobrancasResult.error.message }, { status: 400 })

    const guias = guiasResult.data ?? []
    const cobrancas = cobrancasResult.data ?? []

    return NextResponse.json({
      total_guias: guias.length,
      guias_pendentes: guias.filter((g) => g.status === 'PENDENTE').length,
      guias_processadas: guias.filter((g) => g.status === 'PROCESSADA').length,
      guias_faturadas: guias.filter((g) => g.status === 'FATURADA').length,
      valor_total_faturado: guias.filter((g) => g.status === 'FATURADA').reduce((a, g) => a + (g.valor_total ?? 0), 0),
      valor_total_pago: cobrancas.reduce((a, c) => a + (c.valor_pago ?? 0), 0),
      valor_total_glosado: cobrancas.reduce((a, c) => a + (c.valor_glosado ?? 0), 0),
      lotes_abertos: lotesResult.data?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
