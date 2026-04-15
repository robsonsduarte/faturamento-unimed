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
 * DELETE /api/patient-photos/[id]
 * Remove a foto IA: apaga linha em patient_photos + arquivo no bucket patients.
 */
export async function DELETE(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id obrigatorio' }, { status: 400 })

    const db = getServiceClient()

    const { data: row, error: fetchErr } = await db
      .from('patient_photos')
      .select('storage_path')
      .eq('id', id)
      .single<{ storage_path: string }>()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Foto nao encontrada' }, { status: 404 })
    }

    const path = row.storage_path.replace(/^patients\//, '')
    await db.storage.from('patients').remove([path])
    const { error: delErr } = await db.from('patient_photos').delete().eq('id', id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
