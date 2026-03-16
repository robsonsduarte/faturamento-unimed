import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gerarXmlTiss } from '@/lib/xml/tiss'
import { createHash } from 'crypto'
import type { Lote } from '@/lib/types'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('*, guias(*, procedimentos(*))')
      .eq('id', id)
      .single()

    if (loteError || !lote) {
      return NextResponse.json({ error: 'Lote nao encontrado' }, { status: 404 })
    }

    const xml = gerarXmlTiss(lote as Lote)
    const hash = createHash('md5').update(xml).digest('hex')

    const { error: updateError } = await supabase
      .from('lotes')
      .update({
        xml_content: xml,
        xml_hash: hash,
        status: 'gerado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'lote.generate_xml',
      entity_type: 'lote',
      entity_id: id,
      details: { hash },
    })

    return NextResponse.json({ xml, hash })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
