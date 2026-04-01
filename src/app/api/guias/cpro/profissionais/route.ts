import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import { buscarProfissionaisCpro, buscarAgreementsUnimed } from '@/lib/saw/cpro-client'
import type { CproConfig } from '@/lib/types'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * GET /api/guias/cpro/profissionais
 * Returns professionals and Unimed agreements from CPro.
 */
export async function GET() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth.response

  const db = getServiceClient()

  const { data: cproInteg } = await db
    .from('integracoes')
    .select('config, ativo')
    .eq('slug', 'cpro')
    .single()

  if (!cproInteg?.ativo) {
    return NextResponse.json({ error: 'CPro nao configurado ou inativo' }, { status: 500 })
  }

  const config = cproInteg.config as CproConfig

  const [profissionais, agreements] = await Promise.all([
    buscarProfissionaisCpro(config),
    buscarAgreementsUnimed(config),
  ])

  return NextResponse.json({ profissionais, agreements })
}
