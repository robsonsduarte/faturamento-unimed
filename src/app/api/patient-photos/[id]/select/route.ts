import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'

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
 * POST /api/patient-photos/[id]/select
 * Marca a foto como selected=true e deseleciona as outras da mesma guia.
 */
export async function POST(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

    const db = getServiceClient()

    const { data: row, error: fetchErr } = await db
      .from('patient_photos')
      .select('guia_id')
      .eq('id', id)
      .single<{ guia_id: string }>()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Foto nao encontrada' }, { status: 404 })
    }

    // Deselect all for this guia, then select the target
    await db.from('patient_photos').update({ selected: false }).eq('guia_id', row.guia_id)
    const { error: selErr } = await db
      .from('patient_photos')
      .update({ selected: true })
      .eq('id', id)

    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
