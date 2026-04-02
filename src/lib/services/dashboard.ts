import { createClient } from '@/lib/supabase/client'
import type { DashboardKPIs } from '@/lib/types'

export async function getDashboardKPIs(mes?: string): Promise<DashboardKPIs> {
  const supabase = createClient()

  let guiasQuery = supabase.from('guias').select('status, valor_total')
  let lotesAbertosQuery = supabase.from('lotes').select('status').in('status', ['rascunho', 'gerado', 'enviado'])
  let lotesFaturadosQuery = supabase.from('lotes').select('valor_total').eq('status', 'faturado')
  let cobrancasQuery = supabase.from('cobrancas').select('valor_pago, valor_glosado, valor_cobrado')

  if (mes && mes !== 'todos') {
    const startDate = `${mes}-01`
    const [year, month] = mes.split('-').map(Number)
    const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
    const endDate = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
    guiasQuery = guiasQuery.eq('mes_referencia', mes)
    lotesAbertosQuery = lotesAbertosQuery.eq('referencia', mes)
    lotesFaturadosQuery = lotesFaturadosQuery.eq('referencia', mes)
    cobrancasQuery = cobrancasQuery.gte('created_at', startDate).lt('created_at', endDate)
  }

  const [guiasResult, lotesAbertosResult, lotesFaturadosResult, cobrancasResult] = await Promise.all([
    guiasQuery,
    lotesAbertosQuery,
    lotesFaturadosQuery,
    cobrancasQuery,
  ])

  if (guiasResult.error) throw new Error(guiasResult.error.message)
  if (lotesAbertosResult.error) throw new Error(lotesAbertosResult.error.message)
  if (cobrancasResult.error) throw new Error(cobrancasResult.error.message)

  const guias = guiasResult.data ?? []
  const lotesFaturados = lotesFaturadosResult.data ?? []
  const cobrancas = cobrancasResult.data ?? []

  return {
    total_guias: guias.length,
    guias_pendentes: guias.filter((g) => g.status === 'PENDENTE').length,
    guias_cpro: guias.filter((g) => g.status === 'CPRO').length,
    guias_token: guias.filter((g) => g.status === 'TOKEN').length,
    guias_completas: guias.filter((g) => g.status === 'COMPLETA').length,
    guias_processadas: guias.filter((g) => g.status === 'PROCESSADA').length,
    guias_faturadas: guias.filter((g) => g.status === 'FATURADA').length,
    valor_total_guias: guias.reduce((acc, g) => acc + (g.valor_total ?? 0), 0),
    valor_completas: guias
      .filter((g) => g.status === 'COMPLETA')
      .reduce((acc, g) => acc + (g.valor_total ?? 0), 0),
    valor_processado: guias
      .filter((g) => g.status === 'PROCESSADA')
      .reduce((acc, g) => acc + (g.valor_total ?? 0), 0),
    valor_total_faturado: lotesFaturados.reduce((acc, l) => acc + (l.valor_total ?? 0), 0),
    valor_total_pago: cobrancas.reduce((acc, c) => acc + (c.valor_pago ?? 0), 0),
    valor_total_glosado: cobrancas.reduce((acc, c) => acc + (c.valor_glosado ?? 0), 0),
    lotes_abertos: lotesAbertosResult.data?.length ?? 0,
  }
}
