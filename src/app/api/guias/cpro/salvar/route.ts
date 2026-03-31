import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { salvarGuiaNoCpro } from '@/lib/saw/cpro-client'
import type { CproConfig, Guia, SawXmlData } from '@/lib/types'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface Atendimento {
  date: string       // YYYY-MM-DD
  hour_start: string // HH:mm
}

interface SalvarBody {
  guia_id: string
  user: number
  user_attendant: number
  atendimentos: Atendimento[]
}

/**
 * POST /api/guias/cpro/salvar
 * Saves a guide and its atendimentos into CPro via importar-completa.
 *
 * Body:
 *   guia_id       — UUID of the guia in our DB
 *   user          — executante professional ID in CPro
 *   user_attendant — attendant professional ID in CPro
 *   atendimentos  — array of { date: YYYY-MM-DD, hour_start: HH:mm }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth.response

  // Parse and validate body
  const body = await request.json().catch(() => null) as SalvarBody | null

  if (!body?.guia_id || typeof body.user !== 'number' || typeof body.user_attendant !== 'number') {
    return NextResponse.json(
      { error: 'Campos obrigatorios: guia_id, user (number), user_attendant (number), atendimentos (array)' },
      { status: 400 }
    )
  }

  if (!Array.isArray(body.atendimentos) || body.atendimentos.length === 0) {
    return NextResponse.json(
      { error: 'atendimentos deve ser um array nao vazio' },
      { status: 400 }
    )
  }

  const db = getServiceClient()

  // Fetch guia from DB
  const { data: guia, error: guiaErr } = await db
    .from('guias')
    .select('*')
    .eq('id', body.guia_id)
    .single()

  if (guiaErr || !guia) {
    return NextResponse.json({ error: 'Guia nao encontrada' }, { status: 404 })
  }

  const guiaData = guia as Guia

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

  // Extract procedimento codigo from saw_xml_data
  let codigoProcedimento = ''
  if (guiaData.saw_xml_data) {
    const xmlData = guiaData.saw_xml_data as SawXmlData
    codigoProcedimento = xmlData.procedimentosExecutados?.[0]?.codigoProcedimento ?? ''
  }

  // Build procedimentos — one per atendimento date, sequential item starting at 1
  const procedimentos = body.atendimentos.map((atend, index) => ({
    codigoProcedimento,
    sequencialItem: index + 1,
    dataExecucao: atend.date,
    horaInicial: atend.hour_start,
  }))

  // Build full payload for CPro
  const payload = {
    guia: {
      guide_number: guiaData.guide_number,
      data_autorizacao: guiaData.data_autorizacao,
      senha: guiaData.senha,
      numero_carteira: guiaData.numero_carteira,
      paciente: guiaData.paciente,
      indicacao_clinica: guiaData.indicacao_clinica,
    },
    procedimentos,
    user: body.user,
    user_attendant: body.user_attendant,
    company: config.company,
  }

  const result = await salvarGuiaNoCpro(config, payload)

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error ?? 'Falha ao salvar no CPro' },
      { status: 422 }
    )
  }

  return NextResponse.json({
    success: true,
    cpro_guide_id: result.cpro_guide_id ?? null,
  })
}
