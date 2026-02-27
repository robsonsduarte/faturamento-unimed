const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const START_MONTH = '2026-02'

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export function getNextMonthFirstDay(mes: string): string {
  const [year, month] = mes.split('-').map(Number)
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  return `${next.y}-${String(next.m).padStart(2, '0')}-01`
}

export function getMonthFirstDay(mes: string): string {
  return `${mes}-01`
}

export function formatMonthDisplay(mes: string): string {
  const [year, month] = mes.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]}/${year}`
}

/** Gera lista de meses de START_MONTH ate o mes atual (inclusive). */
export function generateAvailableMonths(): string[] {
  const current = getCurrentMonth()
  const months: string[] = []
  let cursor = START_MONTH

  while (cursor <= current) {
    months.push(cursor)
    cursor = getNextMonthFirstDay(cursor).slice(0, 7)
  }

  return months
}

/** Gera lista de meses de START_MONTH ate um limite futuro (para selects de criacao). */
export function generateMonthsUntil(endYear: number, endMonth: number): string[] {
  const months: string[] = []
  let cursor = START_MONTH
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}`

  while (cursor <= end) {
    months.push(cursor)
    cursor = getNextMonthFirstDay(cursor).slice(0, 7)
  }

  return months
}
