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

/**
 * POST /api/biometria/enviar-whatsapp
 * Sends WhatsApp message to patient with token instructions.
 * Creates a token_request record to track the pending token.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = rateLimit(request, 'biometria-whatsapp', 10, 60_000)
    if (limited) return limited

    const auth = await requireAuth()
    if (isAuthError(auth)) return auth.response
    const { user } = auth

    const body = await request.json() as {
      sessionId?: string
      guia_id?: string
      guide_number?: string
      paciente_nome?: string
      phone_whatsapp?: string
      method?: 'aplicativo' | 'sms'
    }

    if (!body.sessionId || !body.guia_id || !body.phone_whatsapp || !body.method) {
      return NextResponse.json(
        { error: 'sessionId, guia_id, phone_whatsapp e method sao obrigatorios' },
        { status: 400 }
      )
    }

    const db = getServiceClient()

    // Normalizar telefone (remover formatacao, manter apenas digitos com DDI)
    const phoneClean = body.phone_whatsapp.replace(/\D/g, '')
    const phoneBr = phoneClean.startsWith('55') ? phoneClean : `55${phoneClean}`

    // Criar registro de solicitacao (expira em 5 minutos)
    const { data: tokenReq, error: reqErr } = await db
      .from('token_requests')
      .insert({
        guia_id: body.guia_id,
        guide_number: body.guide_number ?? '',
        paciente_nome: body.paciente_nome ?? '',
        phone_whatsapp: phoneBr,
        method: body.method,
        session_id: body.sessionId,
        status: 'waiting',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (reqErr) {
      return NextResponse.json({ error: `Erro ao criar solicitacao: ${reqErr.message}` }, { status: 500 })
    }

    // Montar mensagem baseada no metodo
    let message: string

    if (body.method === 'aplicativo') {
      message = [
        `Ola! Precisamos do token de atendimento para a guia do paciente *${body.paciente_nome ?? ''}*.`,
        '',
        'Por favor, siga os passos:',
        '1. Abra o *aplicativo da Unimed* no celular',
        '2. Acesse a *carteira digital*',
        '3. Copie o *token de 6 digitos* gerado',
        '4. *Responda esta mensagem* com o token',
        '',
        'O token expira em *4 minutos e 30 segundos*.',
        '',
        '_Clinica Dedicare - Faturamento_',
      ].join('\n')
    } else {
      message = [
        `Ola! Enviamos um *token por SMS* para o celular cadastrado na Unimed para a guia do paciente *${body.paciente_nome ?? ''}*.`,
        '',
        'Por favor:',
        '1. Verifique o *SMS* recebido da Unimed',
        '2. *Responda esta mensagem* com o token de 6 digitos',
        '',
        'O token expira em *4 minutos e 30 segundos*.',
        '',
        '_Clinica Dedicare - Faturamento_',
      ].join('\n')
    }

    // Enviar via Evolution API
    const evolutionUrl = process.env.EVOLUTION_API_URL ?? 'https://whatsapp.consultoriopro.com.br'
    const evolutionKey = process.env.EVOLUTION_API_KEY ?? ''
    const instanceName = process.env.EVOLUTION_INSTANCE ?? 'Espaço Dedicare'

    if (!evolutionKey) {
      return NextResponse.json({ error: 'Evolution API key nao configurada' }, { status: 500 })
    }

    const whatsappRes = await fetch(
      `${evolutionUrl}/message/sendText/${encodeURIComponent(instanceName)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: `${phoneBr}@s.whatsapp.net`,
          text: message,
        }),
      }
    )

    if (!whatsappRes.ok) {
      const errText = await whatsappRes.text().catch(() => 'Erro desconhecido')
      return NextResponse.json({ error: `Falha ao enviar WhatsApp: ${errText}` }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      requestId: tokenReq.id,
      message: 'Mensagem enviada. Aguardando resposta do paciente...',
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
