import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}

const variantStyles = {
  default: 'text-[var(--color-text-muted)]',
  primary: 'text-[var(--color-primary)]',
  success: 'text-[var(--color-success)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
}

const variantBg = {
  default: 'bg-[var(--color-text-muted)]/10',
  primary: 'bg-[var(--color-primary)]/10',
  success: 'bg-[var(--color-success)]/10',
  warning: 'bg-[var(--color-warning)]/10',
  danger: 'bg-[var(--color-danger)]/10',
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-muted)] font-medium truncate">{title}</p>
          <p className={cn('text-2xl font-bold mt-1 font-mono', variantStyles[variant])}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg shrink-0', variantBg[variant])}>
          <Icon className={cn('w-5 h-5', variantStyles[variant])} />
        </div>
      </div>
    </div>
  )
}
