import { describe, it, expect } from 'vitest'
import { computeGuideStatus } from '../guide-status'

describe('computeGuideStatus', () => {
  // ─── CANCELADA ───
  it('CANCELADA: SAW status CANCELADA tem prioridade maxima', () => {
    expect(computeGuideStatus(4, 4, 8, '', '84759912', '04/01/2026', 'CANCELADA')).toBe('CANCELADA')
  })

  it('CANCELADA: prioridade sobre TOKEN check-in', () => {
    expect(computeGuideStatus(4, 4, 8, 'Realize o check-in do Paciente', '84759912', '04/01/2026', 'CANCELADA')).toBe('CANCELADA')
  })

  it('CANCELADA: case insensitive', () => {
    expect(computeGuideStatus(null, 0, null, '', null, null, 'cancelada')).toBe('CANCELADA')
  })

  // ─── TOKEN ───
  it('TOKEN: check-in sem CPro cadastrado retorna TOKEN', () => {
    expect(computeGuideStatus(0, 0, 8, 'Realize o check-in do Paciente', '84759912', '04/01/2026')).toBe('TOKEN')
  })

  it('TOKEN: check-in mesmo sem CPro e sem autorizada', () => {
    expect(computeGuideStatus(null, 0, null, 'Realize o check-in do Paciente', null, null)).toBe('TOKEN')
  })

  it('COMPLETA: check-in cede prioridade quando CPro ja tem cadastrados == realizados', () => {
    expect(computeGuideStatus(4, 4, 4, 'Realize o check-in do Paciente', '123', '01/01/2026')).toBe('COMPLETA')
  })

  // ─── COMPLETA ───
  it('COMPLETA: cadastrados == realizados (caso da imagem: 4/4)', () => {
    expect(computeGuideStatus(4, 4, 8, '', '84759912', '04/01/2026')).toBe('COMPLETA')
  })

  it('COMPLETA: autorizada == realizados', () => {
    expect(computeGuideStatus(8, 8, 8, '', '84759912', '04/01/2026')).toBe('COMPLETA')
  })

  it('CPRO: autorizada == realizados mas sem CPro → CPRO (nao COMPLETA)', () => {
    expect(computeGuideStatus(null, 8, 8, '', '84759912', '04/01/2026')).toBe('CPRO')
  })

  it('COMPLETA: cadastrados == realizados sem autorizada', () => {
    expect(computeGuideStatus(4, 4, null, '', '84759912', '04/01/2026')).toBe('COMPLETA')
  })

  // ─── CPRO ───
  it('CPRO: cadastrados null (CPro nao retornou)', () => {
    expect(computeGuideStatus(null, 3, 8, '', '84759912', '04/01/2026')).toBe('CPRO')
  })

  it('CPRO: cadastrados zero', () => {
    expect(computeGuideStatus(0, 3, 8, '', '84759912', '04/01/2026')).toBe('CPRO')
  })

  // ─── PENDENTE ───
  it('PENDENTE: tem senha + data_aut + realizados < cadastrados', () => {
    expect(computeGuideStatus(8, 4, 8, '', '84759912', '04/01/2026')).toBe('PENDENTE')
  })

  it('PENDENTE: realizados = 0 com autorizacao', () => {
    expect(computeGuideStatus(4, 0, 8, '', '84759912', '04/01/2026')).toBe('PENDENTE')
  })

  // ─── TOKEN (fallback) ───
  it('TOKEN fallback: cadastrados > realizados mas sem senha', () => {
    expect(computeGuideStatus(8, 4, 8, '', null, '04/01/2026')).toBe('TOKEN')
  })

  it('TOKEN fallback: cadastrados > realizados mas sem data_autorizacao', () => {
    expect(computeGuideStatus(8, 4, 8, '', '84759912', null)).toBe('TOKEN')
  })

  it('TOKEN fallback: cadastrados > realizados sem senha nem data_aut', () => {
    expect(computeGuideStatus(8, 4, 8, '', null, null)).toBe('TOKEN')
  })
})
