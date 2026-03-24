import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireRole, isAuthError } from '@/lib/auth'
import { getSawClient } from '@/lib/saw/client'
import type { SawCookie } from '@/lib/saw/client'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const lerGuiaSchema = z.object({
  guide_number: z.string().min(1, 'guide_number e obrigatorio').max(50),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const db = getServiceClient()

    // Busca sessao do usuario autenticado
    const { data: session } = await db
      .from('saw_sessions')
      .select('cookies')
      .eq('user_id', user.id)
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
    const result = await getSawClient().readGuide(user.id, cookies, parsed.data.guide_number)

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
