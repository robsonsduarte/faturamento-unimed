import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

interface AuthResult {
  user: { id: string; email?: string }
  supabase: SupabaseClient
}

interface AuthError {
  response: NextResponse
}

/**
 * Validates that the request is authenticated.
 * Returns the user and supabase client, or an error response.
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      response: NextResponse.json({ error: 'Nao autenticado' }, { status: 401 }),
    }
  }

  return { user, supabase }
}

/**
 * Validates authentication + role authorization.
 * Allowed roles: 'admin' and 'operador' by default.
 */
export async function requireRole(
  allowedRoles: Array<'admin' | 'operador' | 'visualizador'> = ['admin', 'operador']
): Promise<AuthResult | AuthError> {
  const result = await requireAuth()
  if ('response' in result) return result

  const { user, supabase } = result

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role)) {
    return {
      response: NextResponse.json({ error: 'Permissao insuficiente' }, { status: 403 }),
    }
  }

  return { user, supabase }
}

/** Type guard to check if result is an error */
export function isAuthError(result: AuthResult | AuthError): result is AuthError {
  return 'response' in result
}
