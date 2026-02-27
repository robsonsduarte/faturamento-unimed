import { createClient } from '@/lib/supabase/client'
import type { Cobranca, PaginatedResponse } from '@/lib/types'

export interface CobrancaFilters {
  status?: string
  page?: number
  pageSize?: number
  mes?: string
}

export async function getCobrancas(
  filters: CobrancaFilters = {}
): Promise<PaginatedResponse<Cobranca>> {
  const supabase = createClient()
  const { status, page = 1, pageSize = 20, mes } = filters

  let query = supabase
    .from('cobrancas')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (mes && mes !== 'todos') {
    const startDate = `${mes}-01`
    const [year, month] = mes.split('-').map(Number)
    const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
    const endDate = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
    query = query.gte('data_cobranca', startDate).lt('data_cobranca', endDate)
  }

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error, count } = await query

  if (error) throw new Error(error.message)

  return {
    data: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
  }
}

export async function getCobrancasResumo(mes?: string) {
  const supabase = createClient()

  let query = supabase.from('cobrancas').select('*')

  if (mes && mes !== 'todos') {
    const startDate = `${mes}-01`
    const [year, month] = mes.split('-').map(Number)
    const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
    const endDate = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
    query = query.gte('data_cobranca', startDate).lt('data_cobranca', endDate)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const cobrancas = data ?? []
  return {
    total_cobrado: cobrancas.reduce((a, c) => a + (c.valor_cobrado ?? 0), 0),
    total_pago: cobrancas.reduce((a, c) => a + (c.valor_pago ?? 0), 0),
    total_glosado: cobrancas.reduce((a, c) => a + (c.valor_glosado ?? 0), 0),
    total_pendente: cobrancas.filter((c) => c.status === 'pendente').length,
    total_recurso: cobrancas.filter((c) => c.status === 'recurso').length,
  }
}
