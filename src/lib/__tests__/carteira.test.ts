import { describe, it, expect } from 'vitest'
import { normalizeCarteira, classifyGuia } from '../carteira'

describe('normalizeCarteira', () => {
  it('strips non-digit chars and returns digits only', () => {
    expect(normalizeCarteira('865 - 0057941759008')).toBe('8650057941759008')
    expect(normalizeCarteira('0865.1234.5678')).toBe('086512345678')
  })

  it('keeps full digit string unchanged', () => {
    expect(normalizeCarteira('08650057941759008')).toBe('08650057941759008')
    expect(normalizeCarteira('7302020807001')).toBe('7302020807001')
  })

  it('returns null for empty/null', () => {
    expect(normalizeCarteira(null)).toBeNull()
    expect(normalizeCarteira(undefined)).toBeNull()
    expect(normalizeCarteira('')).toBeNull()
  })
})

describe('classifyGuia', () => {
  it('Local: digits start with 0865', () => {
    expect(classifyGuia('08650057941759008')).toBe('Local')
    expect(classifyGuia('08651234567890')).toBe('Local')
  })

  it('Local: digits start with 865 (without leading zero)', () => {
    expect(classifyGuia('8650057941759008')).toBe('Local')
    expect(classifyGuia('8651234567890')).toBe('Local')
  })

  it('Local: raw SAW format with spaces and hyphens', () => {
    expect(classifyGuia('865 - 0057941759008')).toBe('Local')
    expect(classifyGuia('0865 0057941759008')).toBe('Local')
  })

  it('Intercambio: carteira from screenshot (7302020807001)', () => {
    expect(classifyGuia('7302020807001')).toBe('Intercambio')
  })

  it('Intercambio: other prefixes', () => {
    expect(classifyGuia('12345678901234')).toBe('Intercambio')
    expect(classifyGuia('99991234567890')).toBe('Intercambio')
    expect(classifyGuia('0057941759008')).toBe('Intercambio')
  })

  it('Intercambio: null/empty defaults to Intercambio', () => {
    expect(classifyGuia(null)).toBe('Intercambio')
    expect(classifyGuia(undefined)).toBe('Intercambio')
    expect(classifyGuia('')).toBe('Intercambio')
  })
})
