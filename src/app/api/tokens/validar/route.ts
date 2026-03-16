import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { tokenValidarSchema } from '@/lib/validations/token'
import { auditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'token-validar', 10, 60_000)
    if (limited) return limited

    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth

    const body = await request.json() as unknown
    const parsed = tokenValidarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }, { status: 400 })
    }

    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null
    const userAgent = request.headers.get('user-agent') ?? null

    const { data, error } = await supabase
      .from('tokens_biometricos')
      .insert({
        guia_id: parsed.data.guia_id,
        paciente_nome: parsed.data.paciente_nome,
        numero_carteira: parsed.data.numero_carteira,
        token: parsed.data.token,
        validado: true,
        data_validacao: new Date().toISOString(),
        ip_origem: ip,
        user_agent: userAgent,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Atualizar guia com token validado
    await supabase
      .from('guias')
      .update({ token_biometrico: true, data_token: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', parsed.data.guia_id)

    await auditLog(supabase, auth.user.id, 'token.validate', 'token_biometrico', data.id, {
      guia_id: parsed.data.guia_id,
      paciente: parsed.data.paciente_nome,
    }, request)

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
