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
  params: Promise<{ requestId: string }>
}

/**
 * GET /api/biometria/token-status/[requestId]
 * Returns the current status of a token request (for polling).
 */
export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { requestId } = await params
    const db = getServiceClient()

    const { data, error } = await db
      .from('token_requests')
      .select('id, status, token_received, error_message, updated_at')
      .eq('id', requestId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Solicitacao nao encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
