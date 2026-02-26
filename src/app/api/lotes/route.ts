import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { loteCreateSchema } from '@/lib/validations/lote'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = Number(searchParams.get('page') ?? '1')
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '20'), 100)

    let query = supabase
      .from('lotes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data, count, page, pageSize })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const body = await request.json() as unknown
    const parsed = loteCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }, { status: 400 })
    }

    const { guia_ids, ...loteData } = parsed.data

    // Validar que nenhuma guia ja pertence a outro lote
    const { data: guiasComLote } = await supabase
      .from('guias')
      .select('id, guide_number, lote_id')
      .in('id', guia_ids)
      .not('lote_id', 'is', null)

    if (guiasComLote && guiasComLote.length > 0) {
      const nums = guiasComLote.map((g) => g.guide_number).join(', ')
      return NextResponse.json(
        { error: `Guia(s) ja associada(s) a outro lote: ${nums}` },
        { status: 400 }
      )
    }

    // Calcular totais das guias selecionadas
    const { data: guias } = await supabase
      .from('guias')
      .select('id, valor_total')
      .in('id', guia_ids)

    const valor_total = guias?.reduce((acc, g) => acc + (g.valor_total ?? 0), 0) ?? 0

    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .insert({
        ...loteData,
        quantidade_guias: guia_ids.length,
        valor_total,
        created_by: user.id,
      })
      .select()
      .single()

    if (loteError) return NextResponse.json({ error: loteError.message }, { status: 400 })

    // Associar guias ao lote
    const { error: updateError } = await supabase
      .from('guias')
      .update({ lote_id: lote.id, updated_at: new Date().toISOString() })
      .in('id', guia_ids)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'lote.create',
      entity_type: 'lote',
      entity_id: lote.id,
      details: { guia_ids, valor_total },
    })

    return NextResponse.json(lote, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
