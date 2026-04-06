import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { fetchCproData, buscarPatientCpro, buscarPatientByName, buscarAgreementsUnimed } from '@/lib/saw/cpro-client'
import { computeGuideStatus } from '@/lib/guide-status'
import type { CproConfig } from '@/lib/types'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/guias/cpro/verificar
 * Verifica execucoes no CPro, atualiza cpro_data e recomputa status da guia.
 * Chamado como step final do pipeline de emissao.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth.response

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body?.guia_id || !body?.guide_number) {
    return NextResponse.json({ error: 'guia_id e guide_number obrigatorios' }, { status: 400 })
  }

  const db = getServiceClient()

  // Fetch guia current state
  const { data: guia } = await db
    .from('guias')
    .select('*')
    .eq('id', body.guia_id)
    .single()

  if (!guia) {
    return NextResponse.json({ error: 'Guia nao encontrada' }, { status: 404 })
  }

  // Fetch CPro config
  const { data: cproInteg } = await db
    .from('integracoes')
    .select('config, ativo')
    .eq('slug', 'cpro')
    .single()

  if (!cproInteg?.ativo) {
    return NextResponse.json({ error: 'CPro nao configurado ou inativo' }, { status: 500 })
  }

  const config = cproInteg.config as CproConfig

  // Query CPro for fresh data (retry 1x apos 2s — CPro pode demorar a indexar)
  let cproResult = await fetchCproData(body.guide_number as string, config)
  if (!cproResult || cproResult.procedimentosCadastrados === 0) {
    await new Promise((r) => setTimeout(r, 2000))
    cproResult = await fetchCproData(body.guide_number as string, config)
  }

  // Merge cpro_data: existing + fresh CPro result + optional config overrides
  const existingCpro = (guia.cpro_data ?? {}) as Record<string, unknown>
  const updatedCpro: Record<string, unknown> = { ...existingCpro }

  if (cproResult) {
    updatedCpro.procedimentosCadastrados = cproResult.procedimentosCadastrados
    updatedCpro.valorTotal = cproResult.valorTotal
    updatedCpro.valorTotalFormatado = cproResult.valorTotalFormatado
    updatedCpro.profissional = cproResult.profissional
    if (cproResult.userId) updatedCpro.user_id = Number(cproResult.userId)
  }

  // Merge optional config fields from request (agreement, user, patient)
  if (body.agreement_id != null) updatedCpro.agreement_id = body.agreement_id
  if (body.agreement_value != null) updatedCpro.agreement_value = body.agreement_value
  if (body.agreement_title != null) updatedCpro.agreement_title = body.agreement_title
  if (body.user_id != null) updatedCpro.user_id = body.user_id
  if (body.patient_id != null) updatedCpro.patient_id = body.patient_id

  // Enrich patient_id if missing — busca por carteira primeiro, fallback por nome
  if (!updatedCpro.patient_id) {
    const cproCfg = { api_url: config.api_url, api_key: config.api_key, company: config.company ?? '1' }
    const carteira = guia.numero_carteira ? String(guia.numero_carteira).replace(/^0?865/, '') : null
    const patient = (carteira ? await buscarPatientCpro(cproCfg, carteira) : null)
      ?? (guia.paciente ? await buscarPatientByName(cproCfg, guia.paciente) : null)
    if (patient) {
      updatedCpro.patient_id = patient.id
      updatedCpro.patient_name = patient.name
    }
  }

  // Enrich agreement if missing
  if (!updatedCpro.agreement_id) {
    const cproCfg = { api_url: config.api_url, api_key: config.api_key, company: config.company ?? '1' }
    const procCode = guia.saw_data?.codigoProcedimentoSolicitado as string | undefined
    if (procCode) {
      const agreements = await buscarAgreementsUnimed(cproCfg)
      const match = agreements.find((ag) => ag.title.startsWith(procCode))
      if (match) {
        updatedCpro.agreement_id = match.id
        updatedCpro.agreement_value = match.value
        updatedCpro.agreement_title = match.title
      }
    }
  }

  // Recompute status with fresh CPro data
  const sawData = (guia.saw_data ?? {}) as Record<string, unknown>
  const tokenMessage = typeof sawData.tokenMessage === 'string' ? sawData.tokenMessage : ''
  const senhaRaw = typeof sawData.senha === 'string' ? sawData.senha : (guia.senha ?? null)
  const dataAutorizacaoRaw = typeof sawData.dataAutorizacao === 'string' ? sawData.dataAutorizacao : (guia.data_autorizacao ?? null)
  const sawStatus = typeof sawData.status === 'string' ? sawData.status : null

  const procedimentosCadastrados = cproResult?.procedimentosCadastrados ?? (typeof existingCpro.procedimentosCadastrados === 'number' ? existingCpro.procedimentosCadastrados : null)

  const newStatus = computeGuideStatus(
    procedimentosCadastrados,
    guia.procedimentos_realizados ?? 0,
    guia.quantidade_autorizada ?? null,
    tokenMessage,
    senhaRaw,
    dataAutorizacaoRaw,
    sawStatus,
  )

  // Preserve FATURADA/PROCESSADA
  const PRESERVED = ['FATURADA', 'PROCESSADA']
  const finalStatus = PRESERVED.includes(guia.status) ? guia.status : newStatus

  // Update DB
  await db
    .from('guias')
    .update({
      cpro_data: updatedCpro,
      status: finalStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.guia_id)

  return NextResponse.json({
    success: true,
    status: finalStatus,
    procedimentos_cadastrados: procedimentosCadastrados ?? 0,
  })
}
