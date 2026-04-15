import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { salvarFotoBiometria } from '@/lib/services/biometria'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface Props {
  params: Promise<{ id: string }>
}

/**
 * POST /api/patient-photos/[id]/promote
 * Body: { sequence: 1..5 }
 * Baixa a foto IA do bucket 'patients' e grava como foto do paciente
 * (biometria_fotos) no slot indicado, reaproveitando salvarFotoBiometria.
 * Nao deleta o registro patient_photos original.
 */
export async function POST(request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

    const body = await request.json().catch(() => ({})) as { sequence?: number }
    const sequence = Number(body?.sequence)
    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 5) {
      return NextResponse.json({ error: 'sequence deve ser inteiro entre 1 e 5' }, { status: 400 })
    }

    const db = getServiceClient()

    const { data: row, error: fetchErr } = await db
      .from('patient_photos')
      .select('storage_path, guia_id')
      .eq('id', id)
      .single<{ storage_path: string; guia_id: string }>()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Foto IA nao encontrada' }, { status: 404 })
    }

    const path = row.storage_path.replace(/^patients\//, '')
    const { data: blob, error: dlErr } = await db.storage.from('patients').download(path)
    if (dlErr || !blob) {
      return NextResponse.json({ error: `Erro ao baixar foto IA: ${dlErr?.message ?? 'sem blob'}` }, { status: 500 })
    }

    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUrl = `data:image/jpeg;base64,${base64}`

    const result = await salvarFotoBiometria(
      row.guia_id,
      dataUrl,
      auth.user.id,
      sequence,
      { operatorId: auth.user.id, processingStatus: 'skipped' }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Erro ao promover foto' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      sequence: result.sequence,
      photo_path: result.photo_path,
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
