import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { procedimentoUpdateSchema } from '@/lib/validations/procedimento'
import { auditLog } from '@/lib/audit'

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
    const parsed = procedimentoUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('procedimentos')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog(supabase, user.id, 'procedimento.update', 'procedimento', id, { fields: Object.keys(parsed.data) }, request)

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { error } = await supabase.from('procedimentos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await auditLog(supabase, user.id, 'procedimento.delete', 'procedimento', id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
