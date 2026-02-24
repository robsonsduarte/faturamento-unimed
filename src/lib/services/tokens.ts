import { createClient } from '@/lib/supabase/client'
import type { TokenBiometrico } from '@/lib/types'

export async function getTokens(): Promise<TokenBiometrico[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tokens_biometricos')
    .select('*')
    .order('created_at', { ascending: false })

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
