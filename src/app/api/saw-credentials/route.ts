import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireRole, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const DEFAULT_LOGIN_URL = 'https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW'

const upsertSchema = z.object({
  usuario: z.string().min(1, 'Usuario e obrigatorio'),
  senha: z.string().min(1, 'Senha e obrigatoria'),
  login_url: z.string().url().optional(),
})

/** GET — retorna credenciais SAW do usuario autenticado (sem a senha) */
export async function GET() {
  try {
    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const db = getServiceClient()

    const { data, error } = await db
      .from('saw_credentials')
      .select('id, usuario, login_url, ativo, created_at, updated_at')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ configurada: false, credenciais: null })
    }

    return NextResponse.json({ configurada: true, credenciais: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/** PUT — cria ou atualiza credenciais SAW do usuario autenticado */
export async function PUT(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'saw-credentials', 10, 60_000)
    if (limited) return limited

    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const body = await request.json() as unknown
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados invalidos' },
        { status: 400 }
      )
    }

    const db = getServiceClient()

    const { data, error } = await db
      .from('saw_credentials')
      .upsert(
        {
          user_id: user.id,
          usuario: parsed.data.usuario,
          senha: parsed.data.senha,
          login_url: parsed.data.login_url ?? DEFAULT_LOGIN_URL,
          ativo: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('id, usuario, login_url, ativo')
      .single()

    if (error) {
      return NextResponse.json(
        { error: `Falha ao salvar credenciais: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, credenciais: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/** DELETE — remove credenciais SAW do usuario autenticado */
export async function DELETE() {
  try {
    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const db = getServiceClient()

    await db
      .from('saw_credentials')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
