import { NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'

export async function GET() {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth
    const { data, error } = await supabase.from('cobrancas').select('*')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const cobrancas = data ?? []
    return NextResponse.json({
      total_cobrado: cobrancas.reduce((a, c) => a + (c.valor_cobrado ?? 0), 0),
      total_pago: cobrancas.reduce((a, c) => a + (c.valor_pago ?? 0), 0),
      total_glosado: cobrancas.reduce((a, c) => a + (c.valor_glosado ?? 0), 0),
      total_pendente: cobrancas.filter((c) => c.status === 'pendente').length,
      total_recurso: cobrancas.filter((c) => c.status === 'recurso').length,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
