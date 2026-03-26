import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { getSawClient } from '@/lib/saw/client'

/**
 * POST /api/biometria/selecionar-metodo
 * Selects token method (aplicativo/sms) on the already-open SAW page.
 * For SMS: selects phone and clicks "Enviar".
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const body = await request.json() as {
      sessionId?: string
      method?: 'aplicativo' | 'sms'
      phone?: string
    }

    if (!body.sessionId || !body.method) {
      return NextResponse.json({ error: 'sessionId e method sao obrigatorios' }, { status: 400 })
    }

    if (body.method === 'sms' && !body.phone) {
      return NextResponse.json({ error: 'phone obrigatorio para metodo SMS' }, { status: 400 })
    }

    const result = await getSawClient().selectTokenMethod(
      body.sessionId,
      body.method,
      body.phone
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({ success: true, method: body.method })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
