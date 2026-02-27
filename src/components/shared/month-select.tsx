'use client'

import { cn } from '@/lib/utils'
import { generateMonthsUntil, formatMonthDisplay, getCurrentMonth } from '@/lib/month-utils'

interface MonthSelectProps {
  value: string
  onChange: (mes: string) => void
}

export function MonthSelect({ value, onChange }: MonthSelectProps) {
  const current = getCurrentMonth()
  const months = generateMonthsUntil(2076, 12)

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
      )}
    >
      {months.map((m) => (
        <option key={m} value={m} disabled={m > current}>
          {formatMonthDisplay(m)}
        </option>
      ))}
    </select>
  )
}
