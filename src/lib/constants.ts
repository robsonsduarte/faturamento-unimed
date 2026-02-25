export const DEDICARE = {
  REGISTRO_ANS: '339679',
  CODIGO_PRESTADOR: '97498504',
  NOME_PRESTADOR: 'DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO',
  CNES: '9794220',
  PADRAO_TISS: '4.02.00',
} as const

export const VALORES_PROCEDIMENTO: Record<string, number> = {
  fonoaudiologia: 35.0,
  psicomotricidade: 70.0,
  default: 30.36,
}

export const GUIDE_STATUS_FLOW = [
  'PENDENTE',
  'CPRO',
  'TOKEN',
  'COMPLETA',
  'PROCESSADA',
  'FATURADA',
  'CANCELADA',
] as const

export type GuideStatus = (typeof GUIDE_STATUS_FLOW)[number]

export const GUIDE_STATUS_COLORS: Record<GuideStatus, string> = {
  PENDENTE: 'bg-slate-500',
  CPRO: 'bg-blue-500',
  TOKEN: 'bg-amber-500',
  COMPLETA: 'bg-emerald-500',
  PROCESSADA: 'bg-sky-500',
  FATURADA: 'bg-green-500',
  CANCELADA: 'bg-red-500',
}

export const GUIDE_STATUS_LABELS: Record<GuideStatus, string> = {
  PENDENTE: 'Pendente',
  CPRO: 'CPro',
  TOKEN: 'Token',
  COMPLETA: 'Completa',
  PROCESSADA: 'Processada',
  FATURADA: 'Faturada',
  CANCELADA: 'Cancelada',
}
