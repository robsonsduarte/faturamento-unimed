import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface DuplicataItem {
  guide_number: string
  guide_number_prestador: string | null
  paciente: string | null
  lote_numero: string | null
  lote_id: string | null
  data_execucao: string
  codigo_procedimento: string
  nome_profissional: string
  descricao: string | null
}

export interface DuplicataGroup {
  chave: string // "data|profissional|codigo"
  data_execucao: string
  nome_profissional: string
  codigo_procedimento: string
  descricao: string | null
  guias: DuplicataItem[]
}

/**
 * GET /api/validacao/duplicatas
 *
 * Busca procedimentos duplicados: mesma data_execucao + mesmo nome_profissional + mesmo codigo_procedimento
 * em guias DIFERENTES que pertencem a lotes (guias cobradas).
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const db = getServiceClient()

    // Busca todos os procedimentos de guias que estao em lotes (cobradas)
    // e que tem os campos necessarios preenchidos
    const { data: procedimentos, error } = await db
      .from('procedimentos')
      .select(`
        data_execucao,
        codigo_procedimento,
        nome_profissional,
        descricao,
        guia_id,
        guias!inner (
          id,
          guide_number,
          guide_number_prestador,
          paciente,
          lote_id,
          lotes (
            numero_lote
          )
        )
      `)
      .not('data_execucao', 'is', null)
      .not('codigo_procedimento', 'is', null)
      .not('nome_profissional', 'is', null)
      .not('guias.lote_id', 'is', null)

    if (error) {
      console.error('[VALIDACAO] Erro ao buscar procedimentos:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!procedimentos || procedimentos.length === 0) {
      return NextResponse.json({ duplicatas: [], total: 0 })
    }

    // Agrupa por chave: data_execucao + nome_profissional + codigo_procedimento
    const groups = new Map<string, DuplicataItem[]>()

    for (const proc of procedimentos) {
      const guia = proc.guias as unknown as {
        id: string
        guide_number: string
        guide_number_prestador: string | null
        paciente: string | null
        lote_id: string | null
        lotes: { numero_lote: string } | null
      }

      if (!guia || !proc.data_execucao || !proc.codigo_procedimento || !proc.nome_profissional) continue

      const chave = `${proc.data_execucao}|${proc.nome_profissional.trim().toLowerCase()}|${proc.codigo_procedimento.trim()}`

      const item: DuplicataItem = {
        guide_number: guia.guide_number,
        guide_number_prestador: guia.guide_number_prestador,
        paciente: guia.paciente,
        lote_numero: guia.lotes?.numero_lote ?? null,
        lote_id: guia.lote_id,
        data_execucao: proc.data_execucao,
        codigo_procedimento: proc.codigo_procedimento,
        nome_profissional: proc.nome_profissional,
        descricao: proc.descricao,
      }

      const existing = groups.get(chave) ?? []
      existing.push(item)
      groups.set(chave, existing)
    }

    // Filtra apenas grupos com 2+ guias DIFERENTES (duplicatas reais)
    const duplicatas: DuplicataGroup[] = []

    for (const [chave, items] of groups) {
      // Deduplica por guide_number (um procedimento pode aparecer 2x na mesma guia)
      const uniqueGuides = new Map<string, DuplicataItem>()
      for (const item of items) {
        uniqueGuides.set(item.guide_number, item)
      }

      if (uniqueGuides.size >= 2) {
        const [data_execucao, , codigo_procedimento] = chave.split('|')
        const first = items[0]
        duplicatas.push({
          chave,
          data_execucao,
          nome_profissional: first.nome_profissional,
          codigo_procedimento,
          descricao: first.descricao,
          guias: Array.from(uniqueGuides.values()),
        })
      }
    }

    // Ordena por data_execucao desc
    duplicatas.sort((a, b) => b.data_execucao.localeCompare(a.data_execucao))

    return NextResponse.json({
      duplicatas,
      total: duplicatas.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
