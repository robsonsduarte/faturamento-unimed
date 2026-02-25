/**
 * Strips non-digit characters from a carteira number.
 * Returns null if input is empty/null.
 */
export function normalizeCarteira(numero: string | null | undefined): string | null {
  if (!numero) return null
  const digits = numero.replace(/\D/g, '')
  if (digits.length === 0) return null
  return digits
}

/**
 * Classifies a guide as Local or Intercambio based on carteira prefix.
 *
 * Rule: carteira digits starting with "0865" or "865" = Local, else = Intercambio.
 * SAW carteira formats vary (13-17+ digits): "8650057941759008", "08650057941759008", etc.
 */
export function classifyGuia(numeroCarteira: string | null | undefined): 'Local' | 'Intercambio' {
  const digits = normalizeCarteira(numeroCarteira)
  if (!digits) return 'Intercambio'
  return digits.startsWith('0865') || digits.startsWith('865') ? 'Local' : 'Intercambio'
}
