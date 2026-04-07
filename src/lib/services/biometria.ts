import { createClient as createAdminClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Salva foto de biometria no Supabase Storage e cria/atualiza registro.
 * Suporta ate 5 fotos por paciente. Se sequence nao fornecido, usa proximo slot disponivel.
 */
export async function salvarFotoBiometria(
  guiaId: string,
  photoBase64: string,
  userId: string,
  sequence?: number
): Promise<{ success: boolean; photo_path?: string; sequence?: number; error?: string }> {
  const db = getServiceClient()

  // Buscar dados da guia
  const { data: guia, error: guiaErr } = await db
    .from('guias')
    .select('id, guide_number, paciente, numero_carteira')
    .eq('id', guiaId)
    .single()

  if (guiaErr || !guia) {
    return { success: false, error: 'Guia nao encontrada' }
  }

  if (!guia.numero_carteira) {
    return { success: false, error: 'Guia sem numero de carteira' }
  }

  // Converter base64 para buffer
  const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  if (buffer.length > 5 * 1024 * 1024) {
    return { success: false, error: 'Foto excede 5MB' }
  }

  // Determinar sequence
  let targetSequence = sequence
  if (!targetSequence) {
    const { data: existingFotos } = await db
      .from('biometria_fotos')
      .select('sequence')
      .eq('numero_carteira', guia.numero_carteira)
      .order('sequence')

    const usedSequences = new Set((existingFotos ?? []).map((f: { sequence: number }) => f.sequence))
    targetSequence = 1
    for (let i = 1; i <= 5; i++) {
      if (!usedSequences.has(i)) {
        targetSequence = i
        break
      }
      if (i === 5) {
        return { success: false, error: 'Limite de 5 fotos atingido' }
      }
    }
  }

  if (targetSequence < 1 || targetSequence > 5) {
    return { success: false, error: 'Sequence deve ser entre 1 e 5' }
  }

  const photoPath = `biometria/${guia.numero_carteira}_${targetSequence}.jpg`

  // Upload para Storage (upsert)
  const { error: uploadErr } = await db.storage
    .from('biometria')
    .upload(photoPath, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (uploadErr) {
    return { success: false, error: `Erro ao salvar foto: ${uploadErr.message}` }
  }

  // Upsert no banco (UNIQUE numero_carteira + sequence)
  const { error: dbErr } = await db
    .from('biometria_fotos')
    .upsert(
      {
        numero_carteira: guia.numero_carteira,
        paciente_nome: guia.paciente ?? 'Desconhecido',
        photo_path: photoPath,
        sequence: targetSequence,
        captured_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'numero_carteira,sequence' }
    )

  if (dbErr) {
    return { success: false, error: `Erro ao registrar foto: ${dbErr.message}` }
  }

  return { success: true, photo_path: photoPath, sequence: targetSequence }
}

/**
 * Busca todas as fotos de um paciente com URLs assinadas (1h).
 */
export async function buscarFotosPorCarteira(
  numeroCarteira: string
): Promise<{ exists: boolean; fotos?: Array<{ sequence: number; url: string; created_at: string; token_used_at: string | null }>; paciente_nome?: string }> {
  const db = getServiceClient()

  const { data: fotos } = await db
    .from('biometria_fotos')
    .select('photo_path, paciente_nome, sequence, created_at, token_used_at')
    .eq('numero_carteira', numeroCarteira)
    .order('sequence')

  if (!fotos || fotos.length === 0) {
    return { exists: false }
  }

  const fotosComUrl = await Promise.all(
    fotos.map(async (foto: { photo_path: string; sequence: number; created_at: string; paciente_nome: string; token_used_at: string | null }) => {
      const { data: signedUrl } = await db.storage
        .from('biometria')
        .createSignedUrl(foto.photo_path, 3600)
      return {
        sequence: foto.sequence,
        url: signedUrl?.signedUrl ?? '',
        created_at: foto.created_at,
        token_used_at: foto.token_used_at ?? null,
      }
    })
  )

  return {
    exists: true,
    fotos: fotosComUrl,
    paciente_nome: fotos[0].paciente_nome,
  }
}

/**
 * Busca foto existente por numero_carteira.
 * Retorna URL assinada (1h) da primeira foto ou null se nao existe.
 * Mantido para compatibilidade com codigo existente.
 */
export async function buscarFotoPorCarteira(
  numeroCarteira: string
): Promise<{ exists: boolean; url?: string; paciente_nome?: string }> {
  const result = await buscarFotosPorCarteira(numeroCarteira)
  if (!result.exists || !result.fotos || result.fotos.length === 0) {
    return { exists: false }
  }
  return {
    exists: true,
    url: result.fotos[0].url,
    paciente_nome: result.paciente_nome,
  }
}

/**
 * Busca foto base64 para injecao no SAW.
 * Seleciona uma foto aleatoria entre as disponiveis para o paciente.
 */
export async function buscarFotoBase64(
  numeroCarteira: string
): Promise<string | null> {
  const db = getServiceClient()

  // Buscar todas as fotos do paciente
  const { data: fotos } = await db
    .from('biometria_fotos')
    .select('photo_path')
    .eq('numero_carteira', numeroCarteira)
    .order('sequence')

  if (!fotos || fotos.length === 0) return null

  // Selecionar foto aleatoria
  const randomFoto = fotos[Math.floor(Math.random() * fotos.length)] as { photo_path: string }

  const { data: blob } = await db.storage
    .from('biometria')
    .download(randomFoto.photo_path)

  if (!blob) return null

  const buffer = Buffer.from(await blob.arrayBuffer())
  return buffer.toString('base64')
}

/**
 * Busca foto base64 de um paciente por sequence especifica.
 */
export async function buscarFotoBase64PorSequence(
  numeroCarteira: string,
  sequence: number
): Promise<string | null> {
  const db = getServiceClient()

  const { data: foto } = await db
    .from('biometria_fotos')
    .select('photo_path')
    .eq('numero_carteira', numeroCarteira)
    .eq('sequence', sequence)
    .single()

  if (!foto) return null

  const { data: blob } = await db.storage
    .from('biometria')
    .download((foto as { photo_path: string }).photo_path)

  if (!blob) return null

  const buffer = Buffer.from(await blob.arrayBuffer())
  return buffer.toString('base64')
}

/**
 * Lista todas as fotos de um paciente.
 * Retorna array de { sequence, url, created_at }.
 */
export async function listarFotos(
  numeroCarteira: string
): Promise<Array<{ sequence: number; url: string; created_at: string }>> {
  const result = await buscarFotosPorCarteira(numeroCarteira)
  return result.fotos ?? []
}

interface BiofaceTokenPayload {
  guia_id: string
  numero_carteira: string
  sub: string
}

function getBiofaceSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY nao configurado')
  return secret
}

/**
 * Gera JWT para captura publica de bioface (expira em 24h).
 * Token payload: { guia_id, numero_carteira, sub: 'bioface' }
 */
export function gerarTokenBioface(guiaId: string, numeroCarteira: string): string {
  return jwt.sign(
    { guia_id: guiaId, numero_carteira: numeroCarteira, sub: 'bioface' },
    getBiofaceSecret(),
    { expiresIn: '24h' }
  )
}

/**
 * Valida JWT de bioface.
 * Retorna payload com guia_id e numero_carteira, ou null se invalido/expirado.
 */
export function validarTokenBioface(
  token: string
): { guia_id: string; numero_carteira: string } | null {
  try {
    const payload = jwt.verify(token, getBiofaceSecret()) as BiofaceTokenPayload
    if (payload.sub !== 'bioface') return null
    return { guia_id: payload.guia_id, numero_carteira: payload.numero_carteira }
  } catch {
    return null
  }
}
