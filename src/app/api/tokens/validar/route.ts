import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tokenValidarSchema } from '@/lib/validations/token'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

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

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
