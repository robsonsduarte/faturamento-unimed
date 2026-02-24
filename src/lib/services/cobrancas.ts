import { createClient } from '@/lib/supabase/client'
import type { Cobranca, PaginatedResponse } from '@/lib/types'

export interface CobrancaFilters {
  status?: string
  page?: number
  pageSize?: number
}

export async function getCobrancas(
  filters: CobrancaFilters = {}
): Promise<PaginatedResponse<Cobranca>> {
  const supabase = createClient()
  const { status, page = 1, pageSize = 20 } = filters

  let query = supabase
    .from('cobrancas')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)

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

export async function getCobrancasResumo() {
  const supabase = createClient()
  const { data, error } = await supabase.from('cobrancas').select('*')
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
