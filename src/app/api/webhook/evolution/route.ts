import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSawClient } from '@/lib/saw/client'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * POST /api/webhook/evolution
 * Receives messages from Evolution API (WhatsApp).
 * When a 6-digit token is detected, submits it to the waiting SAW page.
 *
 * Evolution sends various event types. We only care about incoming messages.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>

    // Evolution API sends different event types
    const event = body.event as string | undefined

    // We only care about incoming messages
    if (event !== 'messages.upsert') {
      return NextResponse.json({ received: true })
    }

    const data = body.data as Record<string, unknown> | undefined
    if (!data) return NextResponse.json({ received: true })

    // Extract message text
    const message = data.message as Record<string, unknown> | undefined
    const conversation = message?.conversation as string | undefined
    const extendedText = (message?.extendedTextMessage as Record<string, unknown>)?.text as string | undefined
    const text = conversation || extendedText || ''

    if (!text) return NextResponse.json({ received: true })

    // Extract sender phone number
    const key = data.key as Record<string, unknown> | undefined
    const remoteJid = key?.remoteJid as string | undefined
    const fromMe = key?.fromMe as boolean | undefined

    // Ignore messages sent by us
    if (fromMe) return NextResponse.json({ received: true })

    // Extract 6-digit token from message
    const tokenMatch = text.match(/\b(\d{6})\b/)
    if (!tokenMatch) {
      return NextResponse.json({ received: true, noToken: true })
    }

    const token = tokenMatch[1]
    const senderPhone = remoteJid?.replace('@s.whatsapp.net', '') ?? ''

    console.log(`[EVOLUTION] Token detectado: ${token} de ${senderPhone}`)

    const db = getServiceClient()

    // Gerar variações do telefone para matching flexível
    // WhatsApp pode enviar 557399913940 ou 5573999913940 (com/sem 9 extra)
    const digits = senderPhone.replace(/\D/g, '')
    const phoneVariations: string[] = [digits]

    // Se começa com 55 + 2 dígitos DDD + 8 dígitos (sem 9), adicionar versão com 9
    if (/^55\d{2}\d{8}$/.test(digits)) {
      const ddd = digits.substring(2, 4)
      const num = digits.substring(4)
      phoneVariations.push(`55${ddd}9${num}`)
    }
    // Se começa com 55 + 2 dígitos DDD + 9 + 8 dígitos (com 9), adicionar versão sem 9
    if (/^55\d{2}9\d{8}$/.test(digits)) {
      const ddd = digits.substring(2, 4)
      const num = digits.substring(5) // pula o 9
      phoneVariations.push(`55${ddd}${num}`)
    }

    console.log(`[EVOLUTION] Buscando token_request para variações: ${phoneVariations.join(', ')}`)

    // Find active token session for any phone variation
    const { data: pendingRequest } = await db
      .from('token_requests')
      .select('*')
      .in('phone_whatsapp', phoneVariations)
      .eq('status', 'waiting')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!pendingRequest) {
      console.log(`[EVOLUTION] Nenhuma solicitacao pendente para ${phoneVariations.join('/')}`)
      return NextResponse.json({ received: true, noPending: true })
    }

    const sessionId = pendingRequest.session_id as string
    const guiaId = pendingRequest.guia_id as string

    console.log(`[EVOLUTION] Submetendo token ${token} na sessao ${sessionId}`)

    // Update status to processing
    await db
      .from('token_requests')
      .update({ status: 'processing', token_received: token, updated_at: new Date().toISOString() })
      .eq('id', pendingRequest.id)

    // Submit token to the waiting SAW page
    const result = await getSawClient().submitToken(sessionId, token)

    if (result.success) {
      console.log(`[EVOLUTION] Token validado com sucesso para guia ${guiaId}`)

      // Mark as completed
      await db
        .from('token_requests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', pendingRequest.id)

      // Mark guia as resolved
      await db
        .from('guias')
        .update({
          token_biometrico: true,
          data_token: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', guiaId)

      // Send success message via Evolution API
      await sendWhatsAppMessage(
        senderPhone,
        `Token validado com sucesso! A guia ${pendingRequest.guide_number} foi desbloqueada.`
      )
    } else {
      console.log(`[EVOLUTION] Token falhou: ${result.error}`)

      await db
        .from('token_requests')
        .update({ status: 'failed', error_message: result.error, updated_at: new Date().toISOString() })
        .eq('id', pendingRequest.id)

      await sendWhatsAppMessage(
        senderPhone,
        `Token invalido ou expirado. ${result.error ?? 'Tente gerar um novo token no aplicativo da Unimed.'}`
      )
    }

    return NextResponse.json({ received: true, processed: true, success: result.success })
  } catch (err) {
    console.error('[EVOLUTION] Erro no webhook:', err)
    return NextResponse.json({ received: true, error: true })
  }
}

/**
 * Send a WhatsApp message via Evolution API.
 */
async function sendWhatsAppMessage(phone: string, text: string): Promise<void> {
  const evolutionUrl = process.env.EVOLUTION_API_URL ?? 'https://whatsapp.consultoriopro.com.br'
  const evolutionKey = process.env.EVOLUTION_API_KEY ?? ''
  const instanceName = process.env.EVOLUTION_INSTANCE ?? 'Espaço Dedicare'

  if (!evolutionKey) {
    console.log('[EVOLUTION] API key nao configurada, mensagem nao enviada')
    return
  }

  try {
    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

    await fetch(`${evolutionUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: jid,
        text,
      }),
    })
  } catch (err) {
    console.error('[EVOLUTION] Erro ao enviar mensagem:', err)
  }
}
