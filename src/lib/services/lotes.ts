import { createClient } from '@/lib/supabase/client'
import type { Lote, PaginatedResponse } from '@/lib/types'

export interface LoteFilters {
  status?: string
  page?: number
  pageSize?: number
}

export async function getLotes(
  filters: LoteFilters = {}
): Promise<PaginatedResponse<Lote>> {
  const supabase = createClient()
  const { status, page = 1, pageSize = 20 } = filters

  let query = supabase
    .from('lotes')
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

export async function getLote(id: string): Promise<Lote> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('lotes')
    .select('*, guias(*)')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Lote nao encontrado')

  return data as Lote
}
