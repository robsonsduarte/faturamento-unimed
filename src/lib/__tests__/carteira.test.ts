import { describe, it, expect } from 'vitest'
import { normalizeCarteira, classifyGuia } from '../carteira'

describe('normalizeCarteira', () => {
  it('pads short number to 14 digits with leading zeros', () => {
    // 9 digits -> 5 zeros prepended
    expect(normalizeCarteira('865123456')).toBe('00000865123456')
    expect(normalizeCarteira('865123456')?.length).toBe(14)
  })

  it('already 14 digits stays the same', () => {
    expect(normalizeCarteira('08651234567890')).toBe('08651234567890')
  })

  it('13 digits gets 1 zero prepended', () => {
    // 865 prefix with 13 digits -> 0865 after padding (Local)
    expect(normalizeCarteira('8651234567890')).toBe('08651234567890')
    // 730 prefix with 13 digits -> 0730 after padding (Intercambio)
    expect(normalizeCarteira('7302020807001')).toBe('07302020807001')
  })

  it('strips non-digit chars', () => {
    expect(normalizeCarteira('0865.1234.5678')).toBe('00086512345678')
  })

  it('returns null for empty/null', () => {
    expect(normalizeCarteira(null)).toBeNull()
    expect(normalizeCarteira(undefined)).toBeNull()
    expect(normalizeCarteira('')).toBeNull()
  })
})

describe('classifyGuia', () => {
  it('Local: 14-digit carteira starting with 0865', () => {
    expect(classifyGuia('08651234567890')).toBe('Local')
    expect(classifyGuia('08659999999999')).toBe('Local')
  })

  it('Local: 13-digit carteira starting with 865 (becomes 0865 after pad)', () => {
    expect(classifyGuia('8651234567890')).toBe('Local')
    expect(classifyGuia('8659876543210')).toBe('Local')
  })

  it('Intercambio: carteira from screenshot (7302020807001)', () => {
    // 7302020807001 -> 07302020807001 -> starts with 0730 -> Intercambio
    expect(classifyGuia('7302020807001')).toBe('Intercambio')
  })

  it('Intercambio: other prefixes', () => {
    expect(classifyGuia('12345678901234')).toBe('Intercambio')
    expect(classifyGuia('99991234567890')).toBe('Intercambio')
  })

  it('Intercambio: null/empty carteira defaults to Intercambio', () => {
    expect(classifyGuia(null)).toBe('Intercambio')
    expect(classifyGuia(undefined)).toBe('Intercambio')
    expect(classifyGuia('')).toBe('Intercambio')
  })
})
