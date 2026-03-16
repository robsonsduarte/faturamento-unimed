import { createClient } from '@/lib/supabase/client'
import type { Lote, PaginatedResponse } from '@/lib/types'

export interface UpdateLoteStatusResult {
  guias_atualizadas: number
}

export async function updateLoteStatus(
  id: string,
  status: 'processado' | 'faturado',
  numeroFatura?: string
): Promise<UpdateLoteStatusResult> {
  const body: Record<string, string> = { status }
  if (numeroFatura) body.numero_fatura = numeroFatura

  const res = await fetch(`/api/lotes/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json() as { error: string }
    throw new Error(data.error || 'Erro ao atualizar status')
  }

  return res.json() as Promise<UpdateLoteStatusResult>
}

export interface LoteFilters {
  status?: string
  page?: number
  pageSize?: number
  mes?: string
}

export async function getLotes(
  filters: LoteFilters = {}
): Promise<PaginatedResponse<Lote>> {
  const supabase = createClient()
  const { status, page = 1, pageSize = 20, mes } = filters

  let query = supabase
    .from('lotes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (mes && mes !== 'todos') query = query.eq('referencia', mes)

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
    .select('*, guias(id, guide_number, paciente, data_autorizacao, status, valor_total)')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Lote nao encontrado')

  return data as Lote
}
