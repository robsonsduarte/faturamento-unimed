import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole, isAuthError } from '@/lib/auth'

const cproBuscarSchema = z.object({
  guide_number: z.string().min(1, 'guide_number e obrigatorio').max(50),
})

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(['admin', 'operador'])
    if (isAuthError(auth)) return auth.response

    const cproApiUrl = process.env.CPRO_API_URL
    const cproApiKey = process.env.CPRO_API_KEY

    if (!cproApiUrl || !cproApiKey) {
      return NextResponse.json({ error: 'CPRO_API_URL ou CPRO_API_KEY nao configuradas' }, { status: 500 })
    }

    const body = await request.json() as unknown
    const parsed = cproBuscarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados invalidos' }, { status: 400 })
    }

    const res = await fetch(`${cproApiUrl}/api/guias/buscar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cproApiKey}`,
      },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) return NextResponse.json({ error: 'Erro na API ConsultorioPro' }, { status: 502 })

    const data = await res.json() as Record<string, unknown>
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
