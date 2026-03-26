import { createClient as createAdminClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/**
 * Salva foto de biometria no Supabase Storage e cria/atualiza registro.
 * UNIQUE(numero_carteira) = 1 foto por paciente, reutilizavel.
 */
export async function salvarFotoBiometria(
  guiaId: string,
  photoBase64: string,
  userId: string
): Promise<{ success: boolean; photo_path?: string; reused?: boolean; error?: string }> {
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

  const photoPath = `biometria/${guia.numero_carteira}.jpg`

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

  // Upsert no banco (UNIQUE numero_carteira)
  const { error: dbErr } = await db
    .from('biometria_fotos')
    .upsert(
      {
        numero_carteira: guia.numero_carteira,
        paciente_nome: guia.paciente ?? 'Desconhecido',
        photo_path: photoPath,
        captured_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'numero_carteira' }
    )

  if (dbErr) {
    return { success: false, error: `Erro ao registrar foto: ${dbErr.message}` }
  }

  return { success: true, photo_path: photoPath, reused: false }
}

/**
 * Busca foto existente por numero_carteira.
 * Retorna URL assinada (1h) ou null se nao existe.
 */
export async function buscarFotoPorCarteira(
  numeroCarteira: string
): Promise<{ exists: boolean; url?: string; paciente_nome?: string }> {
  const db = getServiceClient()

  const { data: foto } = await db
    .from('biometria_fotos')
    .select('photo_path, paciente_nome')
    .eq('numero_carteira', numeroCarteira)
    .single()

  if (!foto) {
    return { exists: false }
  }

  const { data: signedUrl } = await db.storage
    .from('biometria')
    .createSignedUrl(foto.photo_path, 3600) // 1h

  return {
    exists: true,
    url: signedUrl?.signedUrl ?? undefined,
    paciente_nome: foto.paciente_nome,
  }
}

/**
 * Busca foto base64 para injecao no SAW.
 */
export async function buscarFotoBase64(
  numeroCarteira: string
): Promise<string | null> {
  const db = getServiceClient()

  const { data: foto } = await db
    .from('biometria_fotos')
    .select('photo_path')
    .eq('numero_carteira', numeroCarteira)
    .single()

  if (!foto) return null

  const { data: blob } = await db.storage
    .from('biometria')
    .download(foto.photo_path)

  if (!blob) return null

  const buffer = Buffer.from(await blob.arrayBuffer())
  return buffer.toString('base64')
}
