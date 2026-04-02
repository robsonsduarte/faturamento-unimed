'use client'

import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateAvailableMonthsWithNext, formatMonthDisplay, getCurrentMonth } from '@/lib/month-utils'

interface MonthFilterProps {
  value: string
  onChange: (mes: string) => void
  showAll?: boolean
}

export function MonthFilter({ value, onChange, showAll = true }: MonthFilterProps) {
  const months = generateAvailableMonthsWithNext()

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'px-3 py-2.5 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)]',
          'text-sm text-[var(--color-text)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
        )}
      >
        {showAll && <option value="todos">Todos os meses</option>}
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthDisplay(m)}
          </option>
        ))}
      </select>
    </div>
  )
}

export { getCurrentMonth }
