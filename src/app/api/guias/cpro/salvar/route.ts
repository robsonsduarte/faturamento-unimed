import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { buscarPatientCpro, buscarPatientByName, criarExecucaoCpro, fetchCproData } from '@/lib/saw/cpro-client'
import type { CproConfig, Guia } from '@/lib/types'

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
  multiplicador?: number // 1 or 2 (default 2)
  agreement_id: number
  agreement_value: number
  patient_id?: number // ID do paciente no CPro (prioridade maxima)
}

// ─── Holidays (mirrors CPro HolidayHelper.php) ───

function getEasterDate(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function getHolidays(year: number): Set<string> {
  const holidays = new Set<string>()
  const fmt = (m: number, d: number) => `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const addDate = (d: Date) => holidays.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)

  // National fixed
  holidays.add(`${year}-01-01`)
  holidays.add(`${year}-04-21`)
  holidays.add(`${year}-05-01`)
  holidays.add(`${year}-09-07`)
  holidays.add(`${year}-10-12`)
  holidays.add(`${year}-11-02`)
  holidays.add(`${year}-11-15`)
  holidays.add(`${year}-11-20`)
  holidays.add(`${year}-12-25`)

  // Mobile (based on Easter)
  const easter = getEasterDate(year)
  const easterMs = easter.getTime()
  const day = 86400000
  addDate(new Date(easterMs - 47 * day)) // Carnaval segunda
  addDate(new Date(easterMs - 46 * day)) // Carnaval terca
  addDate(new Date(easterMs - 2 * day))  // Sexta-feira Santa
  addDate(easter)                          // Pascoa
  addDate(new Date(easterMs + 60 * day)) // Corpus Christi

  // Bahia state
  holidays.add(`${year}-07-02`)
  // Itabuna municipal
  holidays.add(`${year}-06-02`)

  return holidays
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isBusinessDay(dateStr: string, holidays: Set<string>): boolean {
  const d = new Date(dateStr + 'T12:00:00')
  return !isWeekend(d) && !holidays.has(dateStr)
}

function nextBusinessDay(dateStr: string, holidays: Set<string>): Date {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  while (isWeekend(d) || holidays.has(formatDate(d))) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

function prevBusinessDay(dateStr: string, holidays: Set<string>): Date {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  while (isWeekend(d) || holidays.has(formatDate(d))) {
    d.setDate(d.getDate() - 1)
  }
  return d
}

/**
 * For multiplicador=2, generates a duplicate date for each atendimento.
 * Skips weekends and holidays. If next biz day crosses month, use previous.
 */
function generateDuplicateDates(
  atendimentos: Atendimento[],
  holidays: Set<string>
): Array<{ appointment_day: string; date: string; hour_start: string }> {
  const all: Array<{ appointment_day: string; date: string; hour_start: string }> = []

  for (const atend of atendimentos) {
    // Original: appointment_day = attendance_day
    all.push({ appointment_day: atend.date, date: atend.date, hour_start: atend.hour_start })

    // Duplicate: appointment_day stays the same, attendance_day changes
    const originalMonth = new Date(atend.date + 'T12:00:00').getMonth()
    const next = nextBusinessDay(atend.date, holidays)

    if (next.getMonth() === originalMonth) {
      all.push({ appointment_day: atend.date, date: formatDate(next), hour_start: atend.hour_start })
    } else {
      const prev = prevBusinessDay(atend.date, holidays)
      all.push({ appointment_day: atend.date, date: formatDate(prev), hour_start: atend.hour_start })
    }
  }

  return all
}

// ─── Route handler ───

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth.response

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

  if (!body.agreement_id || typeof body.agreement_value !== 'number') {
    return NextResponse.json(
      { error: 'Selecione o procedimento/convenio' },
      { status: 400 }
    )
  }

  const multiplicador = body.multiplicador === 1 ? 1 : 2

  const db = getServiceClient()

  const { data: guia, error: guiaErr } = await db
    .from('guias')
    .select('*')
    .eq('id', body.guia_id)
    .single()

  if (guiaErr || !guia) {
    return NextResponse.json({ error: 'Guia nao encontrada' }, { status: 404 })
  }

  const g = guia as Guia

  // ─── RULE 1: Never exceed quantidade_autorizada (existing + new) ───
  // Buscar contagem REAL do CPro (nao confiar no banco local que pode estar desatualizado)
  const qtdAutorizada = g.quantidade_autorizada ?? 0

  // Fetch CPro config antecipadamente para validacao
  const { data: cproIntegEarly } = await db
    .from('integracoes')
    .select('config, ativo')
    .eq('slug', 'cpro')
    .single()
  const configEarly = cproIntegEarly?.ativo ? (cproIntegEarly.config as CproConfig) : null

  let jaCadastradas = g.procedimentos_cadastrados ?? 0
  if (configEarly && g.guide_number) {
    try {
      const cproReal = await fetchCproData(g.guide_number, configEarly)
      if (cproReal) {
        jaCadastradas = cproReal.procedimentosCadastrados
      }
    } catch { /* fallback para banco local */ }
  }

  const novasExecucoes = body.atendimentos.length * multiplicador
  if (qtdAutorizada > 0 && (jaCadastradas + novasExecucoes) > qtdAutorizada) {
    const restante = Math.max(0, qtdAutorizada - jaCadastradas)
    return NextResponse.json(
      { error: `Ja existem ${jaCadastradas} cobrancas cadastradas no CPro. Maximo autorizado: ${qtdAutorizada}. Restam ${restante} vaga(s).` },
      { status: 400 }
    )
  }

  // Build holidays set for all years involved
  const years = new Set(body.atendimentos.map((a) => new Date(a.date + 'T12:00:00').getFullYear()))
  const holidays = new Set<string>()
  for (const y of years) {
    for (const h of getHolidays(y)) holidays.add(h)
  }

  // ─── RULE 3: No weekends or holidays in original dates ───
  for (const atend of body.atendimentos) {
    if (!isBusinessDay(atend.date, holidays)) {
      const d = new Date(atend.date + 'T12:00:00')
      const label = isWeekend(d) ? 'final de semana' : 'feriado'
      return NextResponse.json(
        { error: `Data ${atend.date} cai em ${label}. Selecione apenas dias uteis.` },
        { status: 400 }
      )
    }
  }

  // Generate all execution dates
  const execDates = multiplicador === 2
    ? generateDuplicateDates(body.atendimentos, holidays)
    : body.atendimentos.map((a) => ({ appointment_day: a.date, date: a.date, hour_start: a.hour_start }))

  // ─── RULE 2: No duplicate date for same patient+user ───
  const seen = new Set<string>()
  for (const atend of execDates) {
    const key = `${atend.date}_${body.user}`
    if (seen.has(key)) {
      return NextResponse.json(
        { error: `Data ${atend.date} duplicada para o mesmo profissional. Cada data deve ser unica.` },
        { status: 400 }
      )
    }
    seen.add(key)
  }

  // Reutilizar CPro config ja buscada na validacao
  if (!configEarly) {
    return NextResponse.json({ error: 'CPro nao configurado ou inativo' }, { status: 500 })
  }

  const config = configEarly

  // Find patient — cascata de prioridade:
  // 1. body.patient_id (frontend envia direto)
  // 2. cpro_data.patient_id (importacao anterior)
  // 3. busca por carteira (document)
  // 4. busca por nome completo
  // 5. busca por primeiro+segundo nome (fallback para divergencia de grafia)
  const cd = g.cpro_data as Record<string, unknown> | null
  let patientId: number | null = typeof body.patient_id === 'number' ? body.patient_id : null

  if (!patientId) {
    patientId = typeof cd?.patient_id === 'number' ? cd.patient_id : null
  }

  if (!patientId && g.numero_carteira) {
    const carteiraCpro = g.numero_carteira.replace(/^0?865/, '')
    const patient = await buscarPatientCpro(config, carteiraCpro)
    patientId = patient?.id ?? null
  }

  if (!patientId && g.paciente) {
    // Tentar nome completo
    const patient = await buscarPatientByName(config, g.paciente)
    patientId = patient?.id ?? null

    // Fallback: primeiro + segundo nome (SAW pode ter sobrenome extra)
    if (!patientId) {
      const parts = g.paciente.trim().split(/\s+/)
      if (parts.length >= 2) {
        const shortName = `${parts[0]} ${parts[1]}`
        const patientShort = await buscarPatientByName(config, shortName)
        patientId = patientShort?.id ?? null
      }
    }
  }

  if (!patientId) {
    return NextResponse.json(
      { success: false, error: `Paciente "${g.paciente}" nao encontrado no CPro. Informe o ID do paciente manualmente.` },
      { status: 422 }
    )
  }

  const valorSessao = body.agreement_value

  // Create executions
  const results: Array<{ date: string; success: boolean; id?: number; error?: string }> = []

  for (const atend of execDates) {
    const res = await criarExecucaoCpro(config, {
      company: config.company,
      user: body.user,
      user_attendant: body.user_attendant,
      patient: patientId,
      agreement: body.agreement_id,
      guide_number: g.guide_number,
      appointment_day: atend.appointment_day,
      attendance_day: atend.date,
      attendance_start: atend.hour_start,
      value: valorSessao,
      type: g.tipo_guia === 'Local' ? 'local' : 'intercambio',
      status_guide: 'AUTORIZADA',
      status: 'not-executed',
      authorization_date: g.data_autorizacao,
      password: g.senha,
      validate_password: g.data_validade_senha,
      author: body.user,
    })

    results.push({
      date: atend.date,
      success: res.success,
      id: res.id,
      error: res.error,
    })
  }

  const created = results.filter((r) => r.success).length
  const errors = results.filter((r) => !r.success)

  if (created === 0) {
    return NextResponse.json(
      { success: false, error: errors[0]?.error ?? 'Nenhuma execucao criada no CPro' },
      { status: 422 }
    )
  }

  return NextResponse.json({
    success: true,
    created,
    total: execDates.length,
    patient_id: patientId,
    errors: errors.length > 0 ? errors : undefined,
  })
}
