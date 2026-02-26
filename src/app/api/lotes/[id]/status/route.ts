import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loteStatusSchema } from '@/lib/validations/lote'
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
    const parsed = loteStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Status invalido' }, { status: 400 })
    }

    const { status, observacoes, numero_fatura } = parsed.data

    // Buscar lote atual para validacoes de transicao
    const { data: loteAtual, error: fetchError } = await supabase
      .from('lotes')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !loteAtual) {
      return NextResponse.json({ error: 'Lote nao encontrado' }, { status: 404 })
    }

    // Regra: faturado exige que o lote esteja em 'processado'
    if (status === 'faturado' && loteAtual.status !== 'processado') {
      return NextResponse.json(
        { error: 'O lote precisa estar no status processado antes de ser faturado' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (observacoes) updates.observacoes = observacoes
    if (status === 'enviado') updates.data_envio = new Date().toISOString()
    if (['aceito', 'glosado', 'pago'].includes(status)) {
      updates.data_resposta = new Date().toISOString()
    }
    if (status === 'faturado' && numero_fatura) {
      updates.numero_fatura = numero_fatura
    }

    const { data, error } = await supabase
      .from('lotes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Propagacao de status para guias do lote
    let guiasAtualizadas = 0

    if (status === 'processado') {
      const { data: guiasData, error: guiasError } = await supabase
        .from('guias')
        .update({ status: 'PROCESSADA', updated_at: new Date().toISOString() })
        .eq('lote_id', id)
        .neq('status', 'CANCELADA')
        .select('id')

      if (guiasError) {
        return NextResponse.json(
          { error: `Lote atualizado mas falha ao propagar status das guias: ${guiasError.message}` },
          { status: 500 }
        )
      }

      guiasAtualizadas = guiasData?.length ?? 0

      await auditLog(
        supabase,
        user.id,
        'lote.status_change',
        'lote',
        id,
        { new_status: status, guias_propagadas: 'PROCESSADA', guias_atualizadas: guiasAtualizadas },
        request
      )
    } else if (status === 'faturado') {
      const { data: guiasData, error: guiasError } = await supabase
        .from('guias')
        .update({ status: 'FATURADA', updated_at: new Date().toISOString() })
        .eq('lote_id', id)
        .neq('status', 'CANCELADA')
        .select('id')

      if (guiasError) {
        return NextResponse.json(
          { error: `Lote atualizado mas falha ao propagar status das guias: ${guiasError.message}` },
          { status: 500 }
        )
      }

      guiasAtualizadas = guiasData?.length ?? 0

      await auditLog(
        supabase,
        user.id,
        'lote.status_change',
        'lote',
        id,
        { new_status: status, numero_fatura, guias_propagadas: 'FATURADA', guias_atualizadas: guiasAtualizadas },
        request
      )
    } else {
      await auditLog(
        supabase,
        user.id,
        'lote.status_change',
        'lote',
        id,
        { new_status: status },
        request
      )
    }

    return NextResponse.json({ ...data, guias_atualizadas: guiasAtualizadas })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
