import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/guias/cpro/salvar-config
 * Persists CPro mapping (agreement, user, patient) into guia.cpro_data.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth.response

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body?.guia_id) {
    return NextResponse.json({ error: 'guia_id obrigatorio' }, { status: 400 })
  }

  const db = getServiceClient()

  const { data: guia } = await db
    .from('guias')
    .select('cpro_data')
    .eq('id', body.guia_id)
    .single()

  const existing = (guia?.cpro_data ?? {}) as Record<string, unknown>

  const updated = {
    ...existing,
    agreement_id: body.agreement_id ?? existing.agreement_id,
    agreement_value: body.agreement_value ?? existing.agreement_value,
    agreement_title: body.agreement_title ?? existing.agreement_title,
    user_id: body.user_id ?? existing.user_id,
    patient_id: body.patient_id ?? existing.patient_id,
  }

  await db
    .from('guias')
    .update({ cpro_data: updated })
    .eq('id', body.guia_id)

  return NextResponse.json({ success: true })
}
