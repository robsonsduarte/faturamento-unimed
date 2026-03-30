import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { capturarFotoSchema } from '@/lib/validations/biometria'
import { salvarFotoBiometria } from '@/lib/services/biometria'

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'biometria-capturar', 10, 60_000)
    if (limited) return limited

    const auth = await requireAuth()
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
      auth.user.id,
      parsed.data.sequence
    )

    if (!result.success) {
      const status = result.error === 'Limite de 5 fotos atingido' ? 422 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
