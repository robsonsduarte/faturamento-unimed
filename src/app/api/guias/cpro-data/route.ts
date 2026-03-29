import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { fetchCproData } from '@/lib/saw/cpro-client'
import type { CproConfig } from '@/lib/types'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * GET /api/guias/cpro-data?guide_number=2383251150
 * Returns professional and procedure data from CPro for a guide.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (isAuthError(auth)) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  const guideNumber = request.nextUrl.searchParams.get('guide_number')
  if (!guideNumber) {
    return NextResponse.json({ error: 'guide_number obrigatorio' }, { status: 400 })
  }

  const db = getServiceClient()

  // Get CPro config
  const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
  if (!cproInteg?.ativo) {
    return NextResponse.json({ error: 'CPro nao configurado' }, { status: 500 })
  }

  const cproCfg = cproInteg.config as CproConfig

  // Fetch data from CPro
  const cproData = await fetchCproData(guideNumber, cproCfg)
  if (!cproData) {
    return NextResponse.json({ error: 'Guia nao encontrada no CPro' }, { status: 404 })
  }

  // Also get guide data from our DB for carteira and CID
  const { data: guia } = await db.from('guias')
    .select('numero_carteira, indicacao_clinica, nome_profissional, saw_xml_data')
    .eq('guide_number', guideNumber)
    .single()

  // Extract procedure code from saw_xml_data if available
  let procedimentoCodigo = ''
  if (guia?.saw_xml_data) {
    const xmlData = guia.saw_xml_data as { procedimentosExecutados?: Array<{ codigoProcedimento?: string }> }
    procedimentoCodigo = xmlData.procedimentosExecutados?.[0]?.codigoProcedimento ?? ''
  }

  return NextResponse.json({
    success: true,
    carteira: guia?.numero_carteira ?? '',
    profissional: cproData.profissional,
    indicacaoClinica: guia?.indicacao_clinica ?? '',
    procedimentoCodigo,
    quantidade: cproData.procedimentosCadastrados > 0
      ? Math.min(cproData.procedimentosCadastrados, 8)
      : 4,
  })
}
