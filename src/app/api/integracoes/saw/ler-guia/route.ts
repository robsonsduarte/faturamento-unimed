import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, isAuthError } from '@/lib/auth'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'

const lerGuiaSchema = z.object({
  guide_number: z.string().min(1, 'guide_number e obrigatorio').max(50),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { supabase } = auth

    const { data: integracao, error: integracaoError } = await supabase
      .from('integracoes')
      .select('config, ativo')
      .eq('slug', 'saw')
      .single()

    if (integracaoError || !integracao) {
      return NextResponse.json({ error: 'Configuracao SAW nao encontrada' }, { status: 500 })
    }

    if (!integracao.ativo) {
      return NextResponse.json({ error: 'Integracao SAW esta desativada' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('saw_sessions')
      .select('cookies')
      .eq('valida', true)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!session?.cookies) {
      return NextResponse.json(
        { error: 'Sessao SAW nao encontrada. Faca login primeiro.' },
        { status: 401 }
      )
    }

    const body = await request.json() as unknown
    const parsed = lerGuiaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }, { status: 400 })
    }

    const cookies = session.cookies as SawCookie[]
    const result = await getSawClient().readGuide(cookies, parsed.data.guide_number)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? 'Erro ao ler guia no SAW' },
        { status: 502 }
      )
    }

    return NextResponse.json(result.data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
