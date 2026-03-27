import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface Props {
  params: Promise<{ id: string }>
}

/**
 * GET /api/users/[id] — retorna perfil + credenciais SAW do usuario
 */
export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const { id } = await params
    const db = getServiceClient()

    // Verificar permissao: admin pode ver qualquer usuario, outros so a si mesmos
    const { data: callerProfile } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin' && user.id !== id) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    const { data: profile } = await db.from('profiles').select('*').eq('id', id).single()
    if (!profile) return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 })

    // Buscar credenciais SAW (sem senha)
    const { data: sawCred } = await db
      .from('saw_credentials')
      .select('id, usuario, login_url, ativo, created_at')
      .eq('user_id', id)
      .single()

    return NextResponse.json({ profile, sawCredentials: sawCred })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}

/**
 * PUT /api/users/[id] — atualiza perfil, senha e credenciais SAW
 */
export async function PUT(request: NextRequest, { params }: Props) {
  try {
    const limited = rateLimit(request, 'user-update', 10, 60_000)
    if (limited) return limited

    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const { id } = await params
    const db = getServiceClient()

    // Verificar permissao
    const { data: callerProfile } = await db.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = callerProfile?.role === 'admin'
    const isSelf = user.id === id

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 })
    }

    const body = await request.json() as {
      full_name?: string
      role?: string
      password?: string
      saw_usuario?: string
      saw_senha?: string
      saw_login_url?: string
    }

    // Atualizar perfil
    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.full_name) profileUpdate.full_name = body.full_name
    // Somente admin pode mudar role de outros usuarios
    if (body.role && isAdmin && !isSelf) profileUpdate.role = body.role

    await db.from('profiles').update(profileUpdate).eq('id', id)

    // Atualizar senha (via Supabase Admin)
    if (body.password && body.password.length >= 8) {
      await db.auth.admin.updateUserById(id, { password: body.password })
    }

    // Atualizar credenciais SAW
    if (body.saw_usuario) {
      const sawData: Record<string, unknown> = {
        user_id: id,
        usuario: body.saw_usuario,
        login_url: body.saw_login_url || 'https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW',
        ativo: true,
        updated_at: new Date().toISOString(),
      }
      if (body.saw_senha) sawData.senha = body.saw_senha

      // Verificar se ja existe
      const { data: existing } = await db.from('saw_credentials').select('id').eq('user_id', id).single()

      if (existing) {
        await db.from('saw_credentials').update(sawData).eq('user_id', id)
      } else {
        if (!body.saw_senha) {
          return NextResponse.json({ error: 'Senha SAW obrigatoria para novo cadastro' }, { status: 400 })
        }
        sawData.senha = body.saw_senha
        await db.from('saw_credentials').insert(sawData)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
