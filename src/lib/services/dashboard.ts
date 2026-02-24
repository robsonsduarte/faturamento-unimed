import { createClient } from '@/lib/supabase/client'
import type { DashboardKPIs } from '@/lib/types'

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const supabase = createClient()

  const [guiasResult, lotesResult, cobrancasResult] = await Promise.all([
    supabase.from('guias').select('status, valor_total'),
    supabase.from('lotes').select('status').in('status', ['rascunho', 'gerado', 'enviado']),
    supabase.from('cobrancas').select('valor_pago, valor_glosado, valor_cobrado'),
  ])

  if (guiasResult.error) throw new Error(guiasResult.error.message)
  if (lotesResult.error) throw new Error(lotesResult.error.message)
  if (cobrancasResult.error) throw new Error(cobrancasResult.error.message)

  const guias = guiasResult.data ?? []
  const cobrancas = cobrancasResult.data ?? []

  return {
    total_guias: guias.length,
    guias_pendentes: guias.filter((g) => g.status === 'PENDENTE').length,
    guias_processadas: guias.filter((g) => g.status === 'PROCESSADA').length,
    guias_faturadas: guias.filter((g) => g.status === 'FATURADA').length,
    valor_total_faturado: guias
      .filter((g) => g.status === 'FATURADA')
      .reduce((acc, g) => acc + (g.valor_total ?? 0), 0),
    valor_total_pago: cobrancas.reduce((acc, c) => acc + (c.valor_pago ?? 0), 0),
    valor_total_glosado: cobrancas.reduce((acc, c) => acc + (c.valor_glosado ?? 0), 0),
    lotes_abertos: lotesResult.data?.length ?? 0,
  }
}
