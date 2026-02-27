import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const statusXml = searchParams.get('status_xml')
    const search = searchParams.get('search')
    const page = Number(searchParams.get('page') ?? '1')
    const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '20'), 100)
    const periodoInicio = searchParams.get('periodo_inicio')
    const periodoFim = searchParams.get('periodo_fim')
    const loteId = searchParams.get('lote_id')
    const tipoGuia = searchParams.get('tipo_guia')
    const mes = searchParams.get('mes')

    let query = supabase
      .from('guias')
      .select('*', { count: 'exact' })
      .order('guide_number', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    } else {
      query = query.neq('status', 'CANCELADA')
    }
    if (statusXml) query = query.eq('status_xml', statusXml)
    if (loteId) query = query.eq('lote_id', loteId)
    if (tipoGuia) query = query.eq('tipo_guia', tipoGuia)
    const semLote = searchParams.get('sem_lote')
    if (semLote === 'true') query = query.is('lote_id', null)
    if (search) {
      query = query.or(
        `guide_number.ilike.%${search}%,paciente.ilike.%${search}%,numero_carteira.ilike.%${search}%`
      )
    }
    if (periodoInicio) query = query.gte('data_autorizacao', periodoInicio)
    if (periodoFim) query = query.lte('data_autorizacao', periodoFim)
    if (mes && mes !== 'todos') {
      const startDate = `${mes}-01`
      const [year, month] = mes.split('-').map(Number)
      const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
      const endDate = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
      query = query.gte('data_solicitacao', startDate).lt('data_solicitacao', endDate)
    }

    const from = (page - 1) * pageSize
    query = query.range(from, from + pageSize - 1)

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data, count, page, pageSize })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
