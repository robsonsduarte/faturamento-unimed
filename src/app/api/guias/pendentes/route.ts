import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

const VALID_STATUSES = ['PENDENTE', 'CPRO', 'TOKEN', 'COMPLETA', 'PROCESSADA', 'FATURADA'] as const

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, 'guias-pendentes', 30, 60_000)
  if (limited) return limited

  const auth = await requireRole(['admin', 'operador'])
  if (isAuthError(auth)) {
    return auth.response
  }

  const { supabase } = auth
  const { searchParams } = new URL(request.url)

  const statuses = (searchParams.get('statuses') ?? 'PENDENTE')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const filteredStatuses = statuses.filter((s): s is (typeof VALID_STATUSES)[number] =>
    (VALID_STATUSES as readonly string[]).includes(s)
  )

  if (filteredStatuses.length === 0) {
    return NextResponse.json({ error: 'Nenhum status valido informado' }, { status: 400 })
  }

  const mes = searchParams.get('mes')

  let query = supabase
    .from('guias')
    .select('guide_number', { count: 'exact' })
    .in('status', filteredStatuses)
    .order('updated_at', { ascending: true })

  if (mes && mes !== 'todos') {
    query = query.eq('mes_referencia', mes)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[pendentes] Supabase error:', error.message)
    return NextResponse.json({ error: 'Erro ao buscar guias' }, { status: 500 })
  }

  return NextResponse.json({
    guide_numbers: (data ?? []).map((g) => g.guide_number as string),
    total: count ?? 0,
    loaded: (data ?? []).length,
  })
}
