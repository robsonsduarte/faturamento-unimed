import { createClient } from '@/lib/supabase/client'
import type { TokenBiometrico } from '@/lib/types'

export async function getTokens(mes?: string): Promise<TokenBiometrico[]> {
  const supabase = createClient()

  let query = supabase
    .from('tokens_biometricos')
    .select('*')
    .order('created_at', { ascending: false })

  if (mes && mes !== 'todos') {
    const startDate = `${mes}-01`
    const [year, month] = mes.split('-').map(Number)
    const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
    const endDate = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
    query = query.gte('created_at', startDate).lt('created_at', endDate)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getTokensByGuia(guia_id: string): Promise<TokenBiometrico[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tokens_biometricos')
    .select('*')
    .eq('guia_id', guia_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
