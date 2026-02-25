import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { userInviteSchema } from '@/lib/validations/user'
import { auditLog } from '@/lib/audit'

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

  const body = await request.json().catch(() => ({})) as unknown
  const parsed = userInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }, { status: 400 })
  }

  // Use service role to create user (bypasses email confirmation)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Update role in profiles (trigger creates with default 'operador')
  if (newUser.user) {
    await admin
      .from('profiles')
      .update({ role: parsed.data.role })
      .eq('id', newUser.user.id)
  }

  await auditLog(supabase, user.id, 'user.invite', 'profile', newUser.user.id, {
    email: parsed.data.email,
    role: parsed.data.role,
  }, request)

  return NextResponse.json({
    success: true,
    user: { id: newUser.user.id, email: parsed.data.email, full_name: parsed.data.full_name, role: parsed.data.role },
  })
}
