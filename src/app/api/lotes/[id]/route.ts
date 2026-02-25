import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole, isAuthError } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth
    const { id } = await params
    const { data, error } = await supabase
      .from('lotes')
      .select('*, guias(*)')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { user, supabase } = auth
    const { id } = await params

    // Load lote with its guias
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('id, numero_lote, status, guias(id)')
      .eq('id', id)
      .single()

    if (loteError || !lote) {
      return NextResponse.json({ error: 'Lote nao encontrado' }, { status: 404 })
    }

    // Only allow deleting lotes in rascunho or gerado status
    if (!['rascunho', 'gerado'].includes(lote.status)) {
      return NextResponse.json(
        { error: `Nao e possivel excluir lote com status "${lote.status}". Apenas rascunho ou gerado.` },
        { status: 400 }
      )
    }

    const guiaIds = (lote.guias as { id: string }[]).map((g) => g.id)

    // Return guias to COMPLETA status and remove lote_id
    if (guiaIds.length > 0) {
      await supabase
        .from('guias')
        .update({
          lote_id: null,
          status_xml: 'PENDENTE',
          updated_at: new Date().toISOString(),
        })
        .in('id', guiaIds)
    }

    // Delete the lote
    const { error: deleteError } = await supabase
      .from('lotes')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    await auditLog(supabase, user.id, 'lote.delete', 'lote', id, {
      numero_lote: lote.numero_lote,
      guias_liberadas: guiaIds.length,
    }, request)

    return NextResponse.json({ success: true, guias_liberadas: guiaIds.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
