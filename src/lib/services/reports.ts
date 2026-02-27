import { createClient } from '@/lib/supabase/client'
import type { ReportData } from '@/lib/types'
import { GUIDE_STATUS_FLOW } from '@/lib/constants'
import { LOTE_STATUS_FLOW } from '@/lib/constants'

export async function getReportData(mes?: string): Promise<ReportData> {
  const supabase = createClient()

  let guiasQuery = supabase.from('guias').select('status, valor_total, lote_id')
  let lotesQuery = supabase.from('lotes').select('status, valor_total, numero_fatura')
  let cobrancasQuery = supabase.from('cobrancas').select('valor_cobrado, valor_pago, valor_glosado, status')

  if (mes && mes !== 'todos') {
    const startDate = `${mes}-01`
    const [year, month] = mes.split('-').map(Number)
    const nextM = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
    const endDate = `${nextM.y}-${String(nextM.m).padStart(2, '0')}-01`
    guiasQuery = guiasQuery.gte('data_solicitacao', startDate).lt('data_solicitacao', endDate)
    lotesQuery = lotesQuery.eq('referencia', mes)
    cobrancasQuery = cobrancasQuery.gte('data_cobranca', startDate).lt('data_cobranca', endDate)
  }

  const [guiasResult, lotesResult, cobrancasResult] = await Promise.all([
    guiasQuery,
    lotesQuery,
    cobrancasQuery,
  ])

  if (guiasResult.error) throw new Error(guiasResult.error.message)
  if (lotesResult.error) throw new Error(lotesResult.error.message)
  if (cobrancasResult.error) throw new Error(cobrancasResult.error.message)

  const guias = guiasResult.data ?? []
  const lotes = lotesResult.data ?? []
  const cobrancas = cobrancasResult.data ?? []

  // Guias por status
  const guias_por_status: Record<string, { count: number; valor: number }> = {}
  for (const s of GUIDE_STATUS_FLOW) {
    guias_por_status[s] = { count: 0, valor: 0 }
  }
  for (const g of guias) {
    const s = g.status as string
    if (!guias_por_status[s]) guias_por_status[s] = { count: 0, valor: 0 }
    guias_por_status[s].count++
    guias_por_status[s].valor += g.valor_total ?? 0
  }

  // Guias sem lote
  const semLote = guias.filter((g) => !g.lote_id && g.status !== 'CANCELADA')
  const guias_canceladas = guias.filter((g) => g.status === 'CANCELADA').length

  // Lotes por status
  const lotes_por_status: Record<string, { count: number; valor: number }> = {}
  for (const s of LOTE_STATUS_FLOW) {
    lotes_por_status[s] = { count: 0, valor: 0 }
  }
  for (const l of lotes) {
    const s = l.status as string
    if (!lotes_por_status[s]) lotes_por_status[s] = { count: 0, valor: 0 }
    lotes_por_status[s].count++
    lotes_por_status[s].valor += l.valor_total ?? 0
  }

  // Financeiro
  const total_cobrado = cobrancas.reduce((a, c) => a + (c.valor_cobrado ?? 0), 0)
  const total_pago = cobrancas.reduce((a, c) => a + (c.valor_pago ?? 0), 0)
  const total_glosado = cobrancas.reduce((a, c) => a + (c.valor_glosado ?? 0), 0)
  const cobrancas_pagas = cobrancas.filter((c) => c.status === 'paga').length

  return {
    total_guias: guias.length,
    valor_total_guias: guias.reduce((a, g) => a + (g.valor_total ?? 0), 0),
    guias_por_status,
    guias_sem_lote: semLote.length,
    valor_guias_sem_lote: semLote.reduce((a, g) => a + (g.valor_total ?? 0), 0),
    guias_canceladas,

    total_lotes: lotes.length,
    valor_total_lotes: lotes.reduce((a, l) => a + (l.valor_total ?? 0), 0),
    lotes_por_status,

    total_cobrado,
    total_pago,
    total_glosado,
    a_receber: total_cobrado - total_pago - total_glosado,
    total_cobrancas: cobrancas.length,
    cobrancas_pagas,
  }
}
