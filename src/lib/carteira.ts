/**
 * Normalizes a carteira number to 14 digits (left-padded with zeros).
 * Returns null if input is empty/null.
 */
export function normalizeCarteira(numero: string | null | undefined): string | null {
  if (!numero) return null
  const digits = numero.replace(/\D/g, '')
  if (digits.length === 0) return null
  return digits.padStart(14, '0')
}

/**
 * Classifies a guide as Local or Intercambio based on carteira prefix.
 *
 * Rule: carteira normalized to 14 digits, prefix 0865 = Local, else = Intercambio.
 */
export function classifyGuia(numeroCarteira: string | null | undefined): 'Local' | 'Intercambio' {
  const normalized = normalizeCarteira(numeroCarteira)
  if (!normalized) return 'Intercambio'
  return normalized.startsWith('0865') ? 'Local' : 'Intercambio'
}
