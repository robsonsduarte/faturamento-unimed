import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/auth'
import { buscarFotoPorCarteira } from '@/lib/services/biometria'

interface Props {
  params: Promise<{ carteira: string }>
}

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response

    const { carteira } = await params

    if (!carteira) {
      return NextResponse.json({ error: 'Numero da carteira obrigatorio' }, { status: 400 })
    }

    const result = await buscarFotoPorCarteira(carteira)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
