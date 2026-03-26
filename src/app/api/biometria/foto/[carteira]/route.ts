import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { buscarFotoPorCarteira } from '@/lib/services/biometria'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface Props {
  params: Promise<{ carteira: string }>
}

export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { carteira } = await params
    if (!carteira) return NextResponse.json({ error: 'Numero da carteira obrigatorio' }, { status: 400 })

    const result = await buscarFotoPorCarteira(carteira)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { carteira } = await params
    if (!carteira) return NextResponse.json({ error: 'Numero da carteira obrigatorio' }, { status: 400 })

    const db = getServiceClient()

    // Buscar foto para pegar o path
    const { data: foto } = await db
      .from('biometria_fotos')
      .select('id, photo_path')
      .eq('numero_carteira', carteira)
      .single()

    if (!foto) return NextResponse.json({ error: 'Foto nao encontrada' }, { status: 404 })

    // Deletar do Storage
    await db.storage.from('biometria').remove([foto.photo_path])

    // Deletar do banco
    await db.from('biometria_fotos').delete().eq('id', foto.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
