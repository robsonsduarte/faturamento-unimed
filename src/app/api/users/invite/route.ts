import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
  }

  // Check admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem convidar usuarios' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    email?: string
    full_name?: string
    password?: string
    role?: string
  }

  if (!body.email || !body.full_name || !body.password) {
    return NextResponse.json({ error: 'Email, nome e senha sao obrigatorios' }, { status: 400 })
  }

  const role = body.role === 'admin' || body.role === 'operador' || body.role === 'visualizador'
    ? body.role
    : 'visualizador'

  // Use service role to create user (bypasses email confirmation)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Update role in profiles (trigger creates with default 'operador')
  if (newUser.user) {
    await admin
      .from('profiles')
      .update({ role })
      .eq('id', newUser.user.id)
  }

  return NextResponse.json({
    success: true,
    user: { id: newUser.user.id, email: body.email, full_name: body.full_name, role },
  })
}
