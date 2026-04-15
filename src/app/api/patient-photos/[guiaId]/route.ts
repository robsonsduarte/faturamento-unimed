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
  params: Promise<{ guiaId: string }>
}

interface PatientPhotoRow {
  id: string
  background_name: string
  storage_path: string
  selected: boolean
  created_at: string
}

/**
 * GET /api/patient-photos/[guiaId]
 * Lista fotos IA da guia com signed URLs (1h).
 */
export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { guiaId } = await params
    if (!guiaId) return NextResponse.json({ error: 'guiaId obrigatorio' }, { status: 400 })

    const db = getServiceClient()
    const { data, error } = await db
      .from('patient_photos')
      .select('id, background_name, storage_path, selected, created_at')
      .eq('guia_id', guiaId)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (data ?? []) as PatientPhotoRow[]
    const photos = await Promise.all(
      rows.map(async (p) => {
        const path = p.storage_path.replace(/^patients\//, '')
        const { data: signed } = await db.storage
          .from('patients')
          .createSignedUrl(path, 3600)
        return {
          id: p.id,
          background_name: p.background_name,
          url: signed?.signedUrl ?? '',
          selected: p.selected,
          created_at: p.created_at,
        }
      })
    )

    return NextResponse.json({ photos })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
