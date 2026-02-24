import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loteStatusSchema } from '@/lib/validations/lote'

interface Params {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const body = await request.json() as unknown
    const parsed = loteStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Status invalido' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {
      status: parsed.data.status,
      updated_at: new Date().toISOString(),
    }
    if (parsed.data.observacoes) updates.observacoes = parsed.data.observacoes
    if (parsed.data.status === 'enviado') updates.data_envio = new Date().toISOString()
    if (['aceito', 'glosado', 'pago'].includes(parsed.data.status)) {
      updates.data_resposta = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('lotes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
