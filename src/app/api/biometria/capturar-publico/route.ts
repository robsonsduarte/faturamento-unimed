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

      const token = gerarTokenBioface(guia.id as string, guia.numero_carteira as string, auth.user.id)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://faturamento.consultoriopro.com.br'
      const url = `${appUrl}/bioface/${guia.id}?t=${token}`

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
        'id, guide_number, paciente, numero_carteira, nome_profissional, valor_total, quantidade_autorizada, saw_xml_data'
      )
      .eq('id', guiaId)
      .single()

    if (guiaErr || !guia) {
      return NextResponse.json({ error: 'Guia nao encontrada' }, { status: 404 })
    }

    // Extrair codigo do procedimento do saw_xml_data
    let procCodigo = ''
    if (guia.saw_xml_data) {
      const xmlData = guia.saw_xml_data as { procedimentosExecutados?: Array<{ codigoProcedimento?: string }> }
      procCodigo = xmlData.procedimentosExecutados?.[0]?.codigoProcedimento ?? ''
    }

    // Calcular valor por sessao: valor_total / 2, exceto psicomotricidade (50000012) que é cheio
    const valorTotal = typeof guia.valor_total === 'number' ? guia.valor_total : parseFloat(guia.valor_total ?? '0')
    const valorSessao = procCodigo === '50000012' ? valorTotal : valorTotal / 2

    const carteira = guia.numero_carteira ?? payload.numero_carteira
    const carteiraMasked = carteira.length > 8
      ? `${carteira.slice(0, 3)}-****${carteira.slice(-6)}`
      : carteira

    return NextResponse.json({
      success: true,
      paciente: guia.paciente ?? 'Paciente',
      guia_number: guia.guide_number ?? '',
      profissional: guia.nome_profissional ?? '',
      qtd: guia.quantidade_autorizada ?? 0,
      valor_sessao: valorSessao > 0 ? valorSessao : null,
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

    // Captura publica: captured_by fica NULL; operator_id (do JWT) permite
    // notificar o operador dono do link e o pipeline N8N rotear a notificacao.
    const result = await salvarFotoBiometria(
      guia_id,
      photo_base64,
      null,
      undefined,
      { operatorId: payload.operator_id ?? null, processingStatus: 'pending_ai' }
    )

    if (!result.success) {
      const status = result.error === 'Limite de 5 fotos atingido' ? 422 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    // Notificar destinatario (best-effort, nao bloqueia resposta)
    try {
      const { data: guia } = await db
        .from('guias')
        .select('id, user_id, paciente, guide_number, numero_carteira')
        .eq('id', guia_id)
        .single<{ id: string; user_id: string | null; paciente: string | null; guide_number: string | null; numero_carteira: string | null }>()

      // Destinatarios: operador do JWT > guia.user_id > todos admins/operadores
      let recipients: string[] = []
      if (payload.operator_id) recipients = [payload.operator_id]
      else if (guia?.user_id) recipients = [guia.user_id]
      else {
        const { data: profs } = await db
          .from('profiles')
          .select('id')
          .in('role', ['admin', 'operador'])
        recipients = (profs ?? []).map((p: { id: string }) => p.id)
      }

      if (recipients.length > 0) {
        const rows = recipients.map((uid) => ({
          user_id: uid,
          type: 'bioface_received',
          title: 'Foto bioface recebida',
          body: `${guia?.paciente ?? 'Paciente'} enviou a foto (guia ${guia?.guide_number ?? ''})`.trim(),
          guia_id: guia_id,
          data: {
            numero_carteira: guia?.numero_carteira,
            paciente: guia?.paciente,
            guide_number: guia?.guide_number,
            photo_sequence: result.sequence,
          },
        }))
        await db.from('notifications').insert(rows)
      }
    } catch (err) {
      console.error('[bioface-publico] falha ao criar notification:', err)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
