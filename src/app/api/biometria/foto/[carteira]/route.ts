import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { buscarFotosPorCarteira } from '@/lib/services/biometria'

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

    const result = await buscarFotosPorCarteira(carteira)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { carteira } = await params
    if (!carteira) return NextResponse.json({ error: 'Numero da carteira obrigatorio' }, { status: 400 })

    const { searchParams } = new URL(request.url)
    const sequenceParam = searchParams.get('sequence')
    const sequence = sequenceParam !== null ? parseInt(sequenceParam, 10) : null

    const db = getServiceClient()

    if (sequence !== null) {
      // Deletar foto especifica pelo sequence
      if (isNaN(sequence) || sequence < 1 || sequence > 5) {
        return NextResponse.json({ error: 'Sequence invalido (deve ser 1-5)' }, { status: 400 })
      }

      const { data: foto } = await db
        .from('biometria_fotos')
        .select('id, photo_path')
        .eq('numero_carteira', carteira)
        .eq('sequence', sequence)
        .single()

      if (!foto) return NextResponse.json({ error: 'Foto nao encontrada' }, { status: 404 })

      await db.storage.from('biometria').remove([foto.photo_path])
      await db.from('biometria_fotos').delete().eq('id', foto.id)

      return NextResponse.json({ success: true, deleted: 1 })
    }

    // Deletar TODAS as fotos do paciente
    const { data: fotos } = await db
      .from('biometria_fotos')
      .select('id, photo_path')
      .eq('numero_carteira', carteira)

    if (!fotos || fotos.length === 0) {
      return NextResponse.json({ error: 'Nenhuma foto encontrada' }, { status: 404 })
    }

    const paths = fotos.map((f: { id: string; photo_path: string }) => f.photo_path)
    const ids = fotos.map((f: { id: string; photo_path: string }) => f.id)

    await db.storage.from('biometria').remove(paths)
    await db.from('biometria_fotos').delete().in('id', ids)

    return NextResponse.json({ success: true, deleted: fotos.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
