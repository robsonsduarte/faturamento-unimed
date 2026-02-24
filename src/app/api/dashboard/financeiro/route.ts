import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('cobrancas').select('*')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const cobrancas = data ?? []
    return NextResponse.json({
      total_cobrado: cobrancas.reduce((a, c) => a + (c.valor_cobrado ?? 0), 0),
      total_pago: cobrancas.reduce((a, c) => a + (c.valor_pago ?? 0), 0),
      total_glosado: cobrancas.reduce((a, c) => a + (c.valor_glosado ?? 0), 0),
      taxa_pagamento: cobrancas.length > 0
        ? (cobrancas.filter((c) => c.status === 'paga').length / cobrancas.length) * 100
        : 0,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
