/**
 * Core import logic for a single guide: SAW data + CPro enrichment + DB upsert.
 * This is the single source of truth — all routes call this function.
 */
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchCproData, buscarAgreementsUnimed, buscarPatientCpro, buscarPatientByName, buscarExecucoesPendentes, marcarExecucaoRealizada, deletarExecucoesPorGuia } from '@/lib/saw/cpro-client'
import type { CproConfig } from '@/lib/types'
import { computeGuideStatus } from '@/lib/guide-status'
import { classifyGuia } from '@/lib/carteira'
import { parseSawXml } from '@/lib/xml/saw-xml-parser'

export type LogFn = (type: string, message: string) => void

export interface ImportGuiaOptions {
  /** SAW data returned by readGuide() */
  sawData: Record<string, unknown>
  /** Guide number */
  guideNumber: string
  /** CPro integration config (null = skip CPro) */
  cproConfig: CproConfig | null
  /** Skip CPro fetch (e.g. emission pipeline step) */
  skipCpro?: boolean
  /** Optional mes_referencia to set on first import */
  mesReferencia?: string | null
  /** Optional emission form data fallback for token pages */
  emissionFormData?: Record<string, unknown> | null
  /** Force token_biometrico = true (e.g. after resolver-token) */
  forceTokenBiometrico?: boolean
  /** Logging callback (SSE or console) */
  log?: LogFn
}

export interface ImportGuiaResult {
  success: boolean
  guiaId?: string
  status?: string
  error?: string
}

function getServiceClient(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const orNull = (v: unknown): unknown =>
  typeof v === 'string' && v.trim() === '' ? null : (v ?? null)

const parseDate = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v.trim()) return null
  const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

export async function importarGuia(opts: ImportGuiaOptions): Promise<ImportGuiaResult> {
  const { sawData, guideNumber, cproConfig, log: send = () => {} } = opts
  const db = getServiceClient()

  // ─── 1. CPro fetch ───
  let cproData: Record<string, unknown> | null = null

  if (opts.skipCpro) {
    send('info', `Guia ${guideNumber}: consulta CPro sera feita apos cadastro`)
  } else if (!cproConfig?.api_url || !cproConfig?.api_key) {
    send('info', 'CPro nao configurado — pulando busca de procedimentos cadastrados.')
  } else {
    try {
      send('processing', `Buscando dados CPro da guia ${guideNumber}...`)
      const cproCfg = { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' }
      const cproResult = await fetchCproData(guideNumber, cproCfg)

      if (cproResult) {
        cproData = {
          procedimentosCadastrados: cproResult.procedimentosCadastrados,
          userId: cproResult.userId,
          valorTotal: cproResult.valorTotal,
          valorTotalFormatado: cproResult.valorTotalFormatado,
          profissional: cproResult.profissional,
        }

        const codigoProc = typeof sawData['codigoProcedimentoSolicitado'] === 'string'
          ? sawData['codigoProcedimentoSolicitado'] as string : ''
        const rawNome = sawData['nomeBeneficiario']
        const pacienteNome = (typeof rawNome === 'string' && rawNome.trim() !== '' ? rawNome.trim() : null) as string | null
        const rawCarteira = sawData['numeroCarteira']
        const carteiraBusca = (typeof rawCarteira === 'string' && rawCarteira.trim() !== ''
          ? rawCarteira.trim().replace(/^0?865/, '') : null) as string | null

        const [agreements, patientByDoc, patientByName] = await Promise.all([
          buscarAgreementsUnimed(cproCfg),
          carteiraBusca ? buscarPatientCpro(cproCfg, carteiraBusca) : Promise.resolve(null),
          pacienteNome ? buscarPatientByName(cproCfg, pacienteNome) : Promise.resolve(null),
        ])
        const patient = patientByDoc ?? patientByName

        const matchedAg = codigoProc ? agreements.find((ag) => ag.title.startsWith(codigoProc)) : null
        if (matchedAg) { cproData.agreement_id = matchedAg.id; cproData.agreement_value = matchedAg.value; cproData.agreement_title = matchedAg.title }
        if (patient) { cproData.patient_id = patient.id; cproData.patient_name = patient.name }
        if (cproResult.userId) { cproData.user_id = Number(cproResult.userId) }

        send('info', `Guia ${guideNumber}: CPro retornou ${cproResult.procedimentosCadastrados} procedimento(s) cadastrado(s)`)
      } else {
        send('info', `Guia ${guideNumber}: CPro nao retornou dados (guia nao encontrada na API)`)
      }
    } catch (cproErr) {
      const cproMsg = cproErr instanceof Error ? cproErr.message : 'Erro desconhecido'
      send('info', `Guia ${guideNumber}: CPro falhou (${cproMsg}) — continuando sem dados CPro`)
    }
  }

  // ─── 2. Extract fields ───
  const paciente = orNull(sawData['nomeBeneficiario']) ?? null
  const quantidadeSolicitada = typeof sawData['quantidadeSolicitada'] === 'number' ? sawData['quantidadeSolicitada'] as number : null
  const quantidadeAutorizada = typeof sawData['quantidadeAutorizada'] === 'number' ? sawData['quantidadeAutorizada'] as number : null
  const procedimentosRealizados = typeof sawData['procedimentosRealizados'] === 'number' ? sawData['procedimentosRealizados'] as number : 0
  const procedimentosCadastrados = typeof cproData?.['procedimentosCadastrados'] === 'number' ? cproData['procedimentosCadastrados'] as number : null
  let tokenMessage = typeof sawData['tokenMessage'] === 'string' ? sawData['tokenMessage'] as string : ''

  // Fallback: emission form data for token pages
  const efd = opts.emissionFormData
  if (tokenMessage === 'Realize o check-in do Paciente' && efd && sawData) {
    const fallback = (sawKey: string, efdKey: string) => {
      if (!sawData[sawKey] && efd[efdKey]) { ;(sawData as Record<string, unknown>)[sawKey] = efd[efdKey] }
    }
    fallback('senha', 'senha'); fallback('dataAutorizacao', 'dataAutorizacao')
    fallback('dataValidadeSenha', 'dataValidadeSenha'); fallback('dataSolicitacao', 'dataSolicitacao')
    fallback('nomeProfissional', 'nomeProfissional'); fallback('numeroCarteira', 'numeroCarteira')
    fallback('codigoPrestador', 'codigoPrestador'); fallback('cnes', 'cnes')
    fallback('nomeBeneficiario', 'nomeBeneficiario'); fallback('codigoProcedimentoSolicitado', 'codigoProcedimentoSolicitado')
    if (!sawData['quantidadeSolicitada'] && efd.quantidadeSolicitada) { ;(sawData as Record<string, unknown>)['quantidadeSolicitada'] = efd.quantidadeSolicitada }
    if (!sawData['quantidadeAutorizada'] && efd.quantidadeAutorizada) { ;(sawData as Record<string, unknown>)['quantidadeAutorizada'] = efd.quantidadeAutorizada }
    send('info', `Guia ${guideNumber}: usando dados da emissao como fallback (token page)`)
  }

  const senhaRaw = typeof sawData['senha'] === 'string' ? sawData['senha'] as string : null
  const dataAutorizacaoRaw = typeof sawData['dataAutorizacao'] === 'string' ? sawData['dataAutorizacao'] as string : null
  const sawStatus = typeof sawData['status'] === 'string' ? sawData['status'] as string : null

  // ─── 3. Compute status ───
  const status = computeGuideStatus(procedimentosCadastrados, procedimentosRealizados, quantidadeAutorizada, tokenMessage, senhaRaw, dataAutorizacaoRaw, sawStatus)

  const PRESERVED_STATUSES = ['FATURADA', 'PROCESSADA']
  const { data: existingGuia } = await db.from('guias').select('status').eq('guide_number', guideNumber).single()
  const finalStatus = existingGuia && PRESERVED_STATUSES.includes(existingGuia.status) ? existingGuia.status : status

  send('info', `Guia ${guideNumber}: status = ${finalStatus}${finalStatus !== status ? ` (preservado, calculado seria ${status})` : ''} (realiz=${procedimentosRealizados}, aut=${quantidadeAutorizada}, cpro=${procedimentosCadastrados})`)

  // ─── 4. Build payload ───
  const numeroCarteira = orNull(sawData['numeroCarteira']) as string | null
  const tipoGuia = classifyGuia(numeroCarteira)

  const guiaPayload: Record<string, unknown> = {
    guide_number: guideNumber,
    guide_number_prestador: orNull(sawData['numeroGuiaPrestador']),
    paciente,
    numero_carteira: numeroCarteira,
    senha: orNull(sawData['senha']),
    data_autorizacao: parseDate(sawData['dataAutorizacao']),
    data_validade_senha: parseDate(sawData['dataValidadeSenha']),
    data_solicitacao: parseDate(sawData['dataSolicitacao']),
    quantidade_solicitada: quantidadeSolicitada,
    quantidade_autorizada: quantidadeAutorizada,
    procedimentos_realizados: procedimentosRealizados,
    codigo_prestador: orNull(sawData['codigoPrestador']),
    nome_profissional: orNull(sawData['nomeProfissional']),
    cnes: orNull(sawData['cnes']),
    tipo_atendimento: orNull(sawData['tipoAtendimento']),
    indicacao_acidente: orNull(sawData['indicacaoAcidente']),
    indicacao_clinica: orNull(sawData['indicacaoClinica']),
    user_id: null,
    tipo_guia: tipoGuia,
    token_biometrico: opts.forceTokenBiometrico || tokenMessage === 'Realize o check-in do Paciente',
    saw_data: sawData,
    status: finalStatus,
    updated_at: new Date().toISOString(),
  }

  if (opts.mesReferencia) {
    guiaPayload.mes_referencia = opts.mesReferencia
  }

  // ─── 5. CPro data → payload ───
  let agreementValuePerSession: number | null = null

  if (finalStatus === 'CANCELADA' || finalStatus === 'NEGADA') {
    guiaPayload.cpro_data = null
    guiaPayload.procedimentos_cadastrados = 0
    guiaPayload.valor_total = 0

    if (cproConfig?.api_url && cproConfig?.api_key) {
      try {
        const cproCfg = { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' }
        const { deleted, errors } = await deletarExecucoesPorGuia(cproCfg, guideNumber)
        if (deleted > 0 || errors > 0) {
          send('info', `Guia ${guideNumber}: ${deleted} execucao(oes) deletada(s) no CPro${errors > 0 ? `, ${errors} erro(s)` : ''}`)
        }
      } catch (delErr) {
        send('info', `Guia ${guideNumber}: falha ao deletar execucoes CPro — ${delErr instanceof Error ? delErr.message : 'erro'}`)
      }
    }
    send('info', `Guia ${guideNumber}: status ${finalStatus} — dados CPro removidos`)
  } else if (cproData !== null) {
    guiaPayload.cpro_data = cproData
    guiaPayload.procedimentos_cadastrados = procedimentosCadastrados ?? 0

    const agValue = typeof cproData['agreement_value'] === 'number' ? cproData['agreement_value'] as number : null
    const qtdAut = quantidadeAutorizada ?? 0
    if (agValue && agValue > 0 && qtdAut > 0) {
      guiaPayload.valor_total = agValue * qtdAut
      agreementValuePerSession = agValue
    } else {
      guiaPayload.valor_total = typeof cproData['valorTotal'] === 'number' ? cproData['valorTotal'] : null
    }
  } else {
    // CPro retornou null — limpar dados locais
    guiaPayload.cpro_data = null
    guiaPayload.procedimentos_cadastrados = 0
    const { data: existingCpro } = await db.from('guias').select('cpro_data').eq('guide_number', guideNumber).single()
    const existingAg = typeof (existingCpro?.cpro_data as Record<string, unknown> | null)?.['agreement_value'] === 'number'
      ? (existingCpro?.cpro_data as Record<string, unknown>)['agreement_value'] as number : null
    if (existingAg && existingAg > 0) { agreementValuePerSession = existingAg }
  }

  // ─── 6. Upsert ───
  const { data: upsertedGuia, error: upsertError } = await db
    .from('guias')
    .upsert(guiaPayload, { onConflict: 'guide_number' })
    .select('id')
    .single()

  if (upsertError || !upsertedGuia) {
    return { success: false, error: `Falha ao salvar: ${upsertError?.message ?? 'Erro desconhecido'}` }
  }

  // ─── 7. Recalculate lote ───
  if (existingGuia) {
    const { data: guiaWithLote } = await db.from('guias').select('lote_id').eq('id', upsertedGuia.id).single()
    if (guiaWithLote?.lote_id) {
      const { data: loteGuias } = await db.from('guias').select('valor_total').eq('lote_id', guiaWithLote.lote_id)
      if (loteGuias) {
        const somaLote = loteGuias.reduce((acc: number, g: { valor_total: number | null }) => acc + (g.valor_total ?? 0), 0)
        await db.from('lotes').update({ valor_total: somaLote }).eq('id', guiaWithLote.lote_id)
      }
    }
  }

  // ─── 8. Procedures from SAW ───
  interface ProcDetalhe {
    sequencia: number; data: string; horaInicio: string; horaFim: string
    tabela: string; codigoProcedimento: string; descricao: string; quantidade: number
    via: string; tecnica: string; reducaoAcrescimo: number; valorUnitario: number; valorTotal: number
  }
  const sawProcedimentos = (sawData['procedimentosDetalhes'] ?? []) as ProcDetalhe[]

  await db.from('procedimentos').delete().eq('guia_id', upsertedGuia.id)

  if (sawProcedimentos.length > 0) {
    const profNome = typeof sawData['nomeProfissional'] === 'string' ? sawData['nomeProfissional'] as string : null
    const profConselho = typeof sawData['conselhoProfissional'] === 'string' ? sawData['conselhoProfissional'] as string : null
    const profNumConselho = typeof sawData['numeroConselhoProfissional'] === 'string' ? sawData['numeroConselhoProfissional'] as string : null
    const profUf = typeof sawData['ufProfissional'] === 'string' ? sawData['ufProfissional'] as string : null
    const profCbos = typeof sawData['cbosProfissional'] === 'string' ? sawData['cbosProfissional'] as string : null

    const procRows = sawProcedimentos.map((p) => ({
      guia_id: upsertedGuia.id,
      chave: `${upsertedGuia.id}-${p.sequencia}`,
      sequencia: p.sequencia,
      codigo_tabela: p.tabela || null,
      codigo_procedimento: p.codigoProcedimento || null,
      descricao: p.descricao || null,
      data_execucao: parseDate(p.data),
      hora_inicio: p.horaInicio || null,
      hora_fim: p.horaFim || null,
      quantidade_executada: p.quantidade || 1,
      via_acesso: p.via || null,
      tecnica_utilizada: p.tecnica || null,
      reducao_acrescimo: p.reducaoAcrescimo || 1,
      valor_unitario: agreementValuePerSession ?? p.valorUnitario ?? null,
      valor_total: agreementValuePerSession ?? p.valorTotal ?? null,
      nome_profissional: profNome,
      conselho: profConselho,
      numero_conselho: profNumConselho,
      uf: profUf,
      cbos: profCbos,
      status: 'Importado' as const,
    }))

    const { error: procError } = await db.from('procedimentos').insert(procRows)
    if (procError) {
      send('info', `Guia ${guideNumber}: falha ao salvar procedimentos (${procError.message})`)
    } else {
      send('info', `Guia ${guideNumber}: ${procRows.length} procedimento(s) realizado(s) importado(s) do SAW`)
    }
  }

  // ─── 9. XML parse ───
  const sawXmlContent = typeof sawData['xmlContent'] === 'string' ? sawData['xmlContent'] as string : null
  if (sawXmlContent && status === 'COMPLETA') {
    try {
      const sawXmlData = parseSawXml(sawXmlContent)
      await db.from('guias').update({ saw_xml_data: sawXmlData }).eq('id', upsertedGuia.id)
      send('success', `Guia ${guideNumber}: XML oficial parseado (${sawXmlContent.length} bytes)`)
    } catch (xmlErr) {
      send('info', `Guia ${guideNumber}: erro ao processar XML (${xmlErr instanceof Error ? xmlErr.message : 'erro'})`)
    }
  } else if (sawXmlContent && status !== 'COMPLETA') {
    send('info', `Guia ${guideNumber}: XML nao salvo (status != COMPLETA, status atual = ${status})`)
  }

  // ─── 10. Sync CPro realized ───
  if (sawProcedimentos.length > 0 && cproConfig?.api_url && cproConfig?.api_key) {
    try {
      const cproCfg = { api_url: cproConfig.api_url, api_key: cproConfig.api_key, company: cproConfig.company ?? '1' }
      send('processing', `Guia ${guideNumber}: Sincronizando cobrancas com CPro...`)
      const pendentes = await buscarExecucoesPendentes(cproCfg, guideNumber)

      const totalCadastradas = procedimentosCadastrados ?? 0
      const jaRealizadas = totalCadastradas - pendentes.length
      if (jaRealizadas >= sawProcedimentos.length) {
        send('info', `Guia ${guideNumber}: CPro ja tem ${jaRealizadas} realizada(s), SAW tem ${sawProcedimentos.length} — nada a atualizar`)
      } else if (pendentes.length > 0) {
        send('info', `Guia ${guideNumber}: ${pendentes.length} pendente(s) no CPro, ${jaRealizadas} realizada(s), ${sawProcedimentos.length} no SAW`)
        const sawDates = sawProcedimentos.map((p) => {
          const parts = p.data.split('/')
          return { isoDate: parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : p.data, horaInicio: p.horaInicio || '08:00', horaFim: p.horaFim || '08:30' }
        })
        const cproPending = pendentes.map((p) => {
          const parts = p.data.split('/')
          return { ...p, isoDate: parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : p.data }
        })

        const used = new Set<number>()
        let matched = 0
        for (const saw of sawDates) {
          const sawMs = new Date(saw.isoDate + 'T12:00:00').getTime()
          let bestIdx = -1, bestDiff = Infinity
          for (let i = 0; i < cproPending.length; i++) {
            if (used.has(i)) continue
            const diff = Math.abs(sawMs - new Date(cproPending[i].isoDate + 'T12:00:00').getTime())
            if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
          }
          if (bestIdx >= 0) {
            used.add(bestIdx)
            const exec = cproPending[bestIdx]
            const result = await marcarExecucaoRealizada(cproCfg, exec.id, {
              attendance_day: exec.isoDate, attendance_start: exec.horaInicial, attendance_end: exec.horaFinal,
            })
            if (result.success) matched++
          }
        }
        if (matched > 0) send('info', `Guia ${guideNumber}: ${matched} cobranca(s) marcada(s) como realizada(s) no CPro`)
      }
    } catch (matchErr) {
      send('info', `Guia ${guideNumber}: falha ao sincronizar CPro (${matchErr instanceof Error ? matchErr.message : 'erro'})`)
    }
  }

  const pacienteLabel = typeof paciente === 'string' && paciente.length > 0 ? paciente.split(' ')[0] : null
  const qtdLabel = quantidadeAutorizada != null ? `qtd: ${procedimentosRealizados}/${quantidadeAutorizada}` : ''
  const details = [pacienteLabel ? `paciente: ${pacienteLabel}` : '', `status: ${finalStatus}`, qtdLabel].filter(Boolean).join(' | ')
  send('success', `Guia ${guideNumber} importada (${details})`)

  return { success: true, guiaId: upsertedGuia.id, status: finalStatus }
}
