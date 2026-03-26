import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getSawClient } from '@/lib/saw/client'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/biometria/submeter-token
 * Submits a 6-digit token on the already-open SAW page and validates it.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const body = await request.json() as {
      sessionId?: string
      token?: string
      guia_id?: string
    }

    if (!body.sessionId || !body.token) {
      return NextResponse.json({ error: 'sessionId e token sao obrigatorios' }, { status: 400 })
    }

    const result = await getSawClient().submitToken(body.sessionId, body.token)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    // Marcar guia como token resolvido
    if (body.guia_id) {
      const db = getServiceClient()
      await db
        .from('guias')
        .update({
          token_biometrico: true,
          data_token: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', body.guia_id)
    }

    return NextResponse.json({ success: true, message: 'Token validado com sucesso' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
