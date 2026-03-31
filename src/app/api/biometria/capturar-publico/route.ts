import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { requireAuth, isAuthError } from '@/lib/auth'
import { salvarFotoBiometria, validarTokenBioface, gerarTokenBioface } from '@/lib/services/biometria'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function mascaraCarteira(carteira: string): string {
  // Formato: 865-****173540 (mantém prefixo antes do traço + mascara meio + últimos 6)
  const parts = carteira.split('-')
  if (parts.length >= 2) {
    const prefix = parts[0]
    const rest = parts.slice(1).join('')
    const tail = rest.slice(-6)
    return `${prefix}-****${tail}`
  }
  // Fallback: mascara tudo exceto os últimos 6 dígitos
  const tail = carteira.slice(-6)
  return `${'*'.repeat(carteira.length - 6)}${tail}`
}

/**
 * GET /api/biometria/capturar-publico?action=generate-link&guia_id={id}
 * Rota autenticada — gera link publico assinado (JWT) para o paciente capturar a propria foto.
 *
 * GET /api/biometria/capturar-publico?guia_id={id}&t={token}
 * Rota publica — valida JWT e retorna dados da guia para exibicao.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Ramo autenticado: gerar link bioface
    if (action === 'generate-link') {
      const auth = await requireAuth()
      if (isAuthError(auth)) return auth.response

      const guiaId = searchParams.get('guia_id')
      if (!guiaId) {
        return NextResponse.json({ error: 'guia_id obrigatorio' }, { status: 400 })
      }

      const db = getServiceClient()
      const { data: guia, error: guiaErr } = await db
        .from('guias')
        .select('id, guide_number, paciente, numero_carteira')
        .eq('id', guiaId)
        .single()

      if (guiaErr || !guia) {
        return NextResponse.json({ error: 'Guia nao encontrada' }, { status: 404 })
      }

      if (!guia.numero_carteira) {
        return NextResponse.json({ error: 'Guia sem numero de carteira' }, { status: 422 })
      }

      const token = gerarTokenBioface(guia.id as string, guia.numero_carteira as string)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const url = `${appUrl}/bioface/${token}`

      return NextResponse.json({ url })
    }

    // Ramo publico: validar token e retornar dados da guia
    const limited = rateLimit(request, 'bioface-publico', 5, 60_000)
    if (limited) return limited

    const guiaId = searchParams.get('guia_id')
    const token = searchParams.get('t')

    if (!guiaId || !token) {
      return NextResponse.json(
        { error: 'Parametros guia_id e t sao obrigatorios' },
        { status: 400 }
      )
    }

    const payload = validarTokenBioface(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token invalido ou expirado' },
        { status: 401 }
      )
    }

    if (payload.guia_id !== guiaId) {
      return NextResponse.json(
        { error: 'Token nao corresponde a esta guia' },
        { status: 403 }
      )
    }

    const db = getServiceClient()

    const { data: guia, error: guiaErr } = await db
      .from('guias')
      .select(
        'id, guide_number, paciente, numero_carteira, profissional, valor_sessao'
      )
      .eq('id', guiaId)
      .single()

    if (guiaErr || !guia) {
      return NextResponse.json({ error: 'Guia nao encontrada' }, { status: 404 })
    }

    // Contar procedimentos vinculados à guia
    const { count: qtdProcedimentos } = await db
      .from('guia_procedimentos')
      .select('id', { count: 'exact', head: true })
      .eq('guia_id', guiaId)

    const carteiraMasked = mascaraCarteira(guia.numero_carteira ?? payload.numero_carteira)

    return NextResponse.json({
      success: true,
      paciente: guia.paciente ?? 'Paciente',
      guia_number: guia.guide_number ?? '',
      profissional: guia.profissional ?? '',
      qtd: qtdProcedimentos ?? 0,
      valor_sessao: guia.valor_sessao ?? null,
      carteira_masked: carteiraMasked,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/biometria/capturar-publico
 * Rota pública — salva foto com consentimento LGPD registrado.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'bioface-publico', 5, 60_000)
    if (limited) return limited

    const body = await request.json() as unknown

    if (
      typeof body !== 'object' ||
      body === null ||
      !('guia_id' in body) ||
      !('token' in body) ||
      !('photo_base64' in body)
    ) {
      return NextResponse.json(
        { error: 'Campos guia_id, token e photo_base64 sao obrigatorios' },
        { status: 400 }
      )
    }

    const { guia_id, token, photo_base64 } = body as {
      guia_id: string
      token: string
      photo_base64: string
    }

    if (typeof guia_id !== 'string' || typeof token !== 'string' || typeof photo_base64 !== 'string') {
      return NextResponse.json({ error: 'Tipos de campos invalidos' }, { status: 400 })
    }

    const payload = validarTokenBioface(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Token invalido ou expirado' },
        { status: 401 }
      )
    }

    if (payload.guia_id !== guia_id) {
      return NextResponse.json(
        { error: 'Token nao corresponde a esta guia' },
        { status: 403 }
      )
    }

    // Registrar consentimento LGPD antes de salvar a foto
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const lgpdConsentAt = new Date().toISOString()

    const db = getServiceClient()
    await db
      .from('guias')
      .update({ lgpd_consent_at: lgpdConsentAt, lgpd_ip: ip })
      .eq('id', guia_id)

    // 'bioface-publico' como userId para rastreabilidade de capturas publicas
    const result = await salvarFotoBiometria(guia_id, photo_base64, 'bioface-publico')

    if (!result.success) {
      const status = result.error === 'Limite de 5 fotos atingido' ? 422 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
