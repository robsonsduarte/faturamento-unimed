import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth
    const { id } = await params
    const { data: lote, error } = await supabase
      .from('lotes')
      .select('numero_lote, xml_content')
      .eq('id', id)
      .single()

    if (error || !lote) return NextResponse.json({ error: 'Lote nao encontrado' }, { status: 404 })
    if (!lote.xml_content) return NextResponse.json({ error: 'XML nao gerado ainda' }, { status: 400 })

    return new NextResponse(lote.xml_content, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="tiss-lote-${lote.numero_lote}.xml"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
