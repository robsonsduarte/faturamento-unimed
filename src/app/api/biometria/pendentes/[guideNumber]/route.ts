import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAuth, isAuthError } from '@/lib/auth'
import https from 'https'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface Props {
  params: Promise<{ guideNumber: string }>
}

/**
 * GET /api/biometria/pendentes/[guideNumber]
 * Retorna atendimentos pendentes de cobranca (CPro - SAW realizados)
 */
export async function GET(_request: NextRequest, { params }: Props) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response

    const { guideNumber } = await params
    const db = getServiceClient()

    // Buscar guia para pegar id
    const { data: guia } = await db.from('guias').select('id').eq('guide_number', guideNumber).single()
    if (!guia) return NextResponse.json({ pendentes: [] })

    // Buscar procedimentos ja realizados no SAW
    const { data: procRealizados } = await db
      .from('procedimentos')
      .select('data_execucao')
      .eq('guia_id', guia.id)

    const realizedDates = (procRealizados ?? []).map((p) => p.data_execucao).filter(Boolean) as string[]

    // Buscar atendimentos do CPro
    const { data: cproInteg } = await db.from('integracoes').select('config, ativo').eq('slug', 'cpro').single()
    if (!cproInteg?.ativo) return NextResponse.json({ pendentes: [] })

    const cfg = cproInteg.config as Record<string, string>
    const cproUrl = `${cfg.api_url}/service/api/v1/executions/by-guide-number/${guideNumber}?company=${cfg.company ?? '1'}`

    const body = await new Promise<string>((resolve) => {
      const parsed = new URL(cproUrl)
      const req = https.request({
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'X-API-Key': cfg.api_key, Host: 'consultoriopro.com.br', Accept: 'application/json' },
        rejectUnauthorized: false,
        timeout: 15000,
      }, (res) => {
        let data = ''
        res.on('data', (c: Buffer) => { data += c.toString() })
        res.on('end', () => resolve(data))
      })
      req.on('error', () => resolve(''))
      req.on('timeout', () => { req.destroy(); resolve('') })
      req.end()
    })

    if (!body) return NextResponse.json({ pendentes: [] })

    const json = JSON.parse(body)
    const attendances = (json?.data?.attendances ?? []) as Array<{ date: string; start: string; end: string }>

    // Filtrar: CPro que NAO estao no SAW
    const pendentes = attendances.filter((a) => !realizedDates.includes(a.date))

    return NextResponse.json({ pendentes, total: pendentes.length, realizados: realizedDates.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
