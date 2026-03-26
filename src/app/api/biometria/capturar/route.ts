import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { capturarFotoSchema } from '@/lib/validations/biometria'
import { salvarFotoBiometria } from '@/lib/services/biometria'

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'biometria-capturar', 10, 60_000)
    if (limited) return limited

    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response

    const body = await request.json() as unknown
    const parsed = capturarFotoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados invalidos' },
        { status: 400 }
      )
    }

    const result = await salvarFotoBiometria(
      parsed.data.guia_id,
      parsed.data.photo_base64,
      auth.user.id
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
