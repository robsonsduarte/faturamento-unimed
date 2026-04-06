import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { fetchCproData } from '@/lib/saw/cpro-client'
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

  // Query CPro for fresh data
  const cproResult = await fetchCproData(body.guide_number as string, config)

  if (!cproResult) {
    return NextResponse.json({
      success: false,
      error: 'CPro nao retornou dados para esta guia',
      status: guia.status,
      procedimentos_cadastrados: 0,
    })
  }

  // Merge cpro_data: existing + fresh CPro result + optional config overrides
  const existingCpro = (guia.cpro_data ?? {}) as Record<string, unknown>
  const updatedCpro: Record<string, unknown> = {
    ...existingCpro,
    procedimentosCadastrados: cproResult.procedimentosCadastrados,
    valorTotal: cproResult.valorTotal,
    valorTotalFormatado: cproResult.valorTotalFormatado,
    profissional: cproResult.profissional,
  }
  if (cproResult.userId) updatedCpro.user_id = Number(cproResult.userId)

  // Merge optional config fields from request (agreement, user, patient)
  if (body.agreement_id != null) updatedCpro.agreement_id = body.agreement_id
  if (body.agreement_value != null) updatedCpro.agreement_value = body.agreement_value
  if (body.agreement_title != null) updatedCpro.agreement_title = body.agreement_title
  if (body.user_id != null) updatedCpro.user_id = body.user_id
  if (body.patient_id != null) updatedCpro.patient_id = body.patient_id

  // Recompute status with fresh CPro data
  const sawData = (guia.saw_data ?? {}) as Record<string, unknown>
  const tokenMessage = typeof sawData.tokenMessage === 'string' ? sawData.tokenMessage : ''
  const senhaRaw = typeof sawData.senha === 'string' ? sawData.senha : (guia.senha ?? null)
  const dataAutorizacaoRaw = typeof sawData.dataAutorizacao === 'string' ? sawData.dataAutorizacao : (guia.data_autorizacao ?? null)
  const sawStatus = typeof sawData.status === 'string' ? sawData.status : null

  const newStatus = computeGuideStatus(
    cproResult.procedimentosCadastrados,
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
    procedimentos_cadastrados: cproResult.procedimentosCadastrados,
  })
}
