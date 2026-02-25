import { createClient } from '@/lib/supabase/client'
import type { Guia, PaginatedResponse } from '@/lib/types'

export interface GuiaFilters {
  status?: string
  status_xml?: string
  search?: string
  page?: number
  pageSize?: number
  periodo_inicio?: string
  periodo_fim?: string
  lote_id?: string
  tipo_guia?: string
}

export async function getGuias(
  filters: GuiaFilters = {}
): Promise<PaginatedResponse<Guia>> {
  const supabase = createClient()
  const { status, status_xml, search, page = 1, pageSize = 20, periodo_inicio, periodo_fim, lote_id, tipo_guia } = filters

  let query = supabase
    .from('guias')
    .select('*', { count: 'exact' })
    .order('data_solicitacao', { ascending: false, nullsFirst: false })
    .order('guide_number', { ascending: false })

  if (status) query = query.eq('status', status)
  if (status_xml) query = query.eq('status_xml', status_xml)
  if (lote_id) query = query.eq('lote_id', lote_id)
  if (tipo_guia) query = query.eq('tipo_guia', tipo_guia)
  if (search) {
    query = query.or(
      `guide_number.ilike.%${search}%,paciente.ilike.%${search}%,numero_carteira.ilike.%${search}%`
    )
  }
  if (periodo_inicio) query = query.gte('data_autorizacao', periodo_inicio)
  if (periodo_fim) query = query.lte('data_autorizacao', periodo_fim)

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

export async function getGuia(id: string): Promise<Guia> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('guias')
    .select('*, procedimentos(*)')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Guia nao encontrada')

  return data as Guia
}

export async function updateGuiaStatus(id: string, status: Guia['status']): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('guias')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}
