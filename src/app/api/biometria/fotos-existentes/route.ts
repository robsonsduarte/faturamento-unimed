import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/biometria/fotos-existentes
 * Body: { carteiras: string[] }
 * Retorna quais numero_carteira possuem pelo menos uma foto em biometria_fotos.
 * Usado para exibir o icone de camera na listagem de guias.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const body = await request.json() as unknown
    if (
      typeof body !== 'object' ||
      body === null ||
      !('carteiras' in body) ||
      !Array.isArray((body as { carteiras: unknown }).carteiras)
    ) {
      return NextResponse.json({ error: 'carteiras deve ser um array' }, { status: 400 })
    }

    const carteiras = (body as { carteiras: unknown[] }).carteiras.filter(
      (c): c is string => typeof c === 'string' && c.length > 0
    )

    if (carteiras.length === 0) {
      return NextResponse.json({ carteiras_com_foto: [] })
    }

    const db = getServiceClient()
    const { data, error } = await db
      .from('biometria_fotos')
      .select('numero_carteira')
      .in('numero_carteira', carteiras)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const comFoto = [...new Set((data ?? []).map((r: { numero_carteira: string }) => r.numero_carteira))]

    return NextResponse.json({ carteiras_com_foto: comFoto })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
