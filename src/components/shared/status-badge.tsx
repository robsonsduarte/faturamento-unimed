import { cn } from '@/lib/utils'
import {
  GUIDE_STATUS_COLORS,
  GUIDE_STATUS_LABELS,
  type GuideStatus,
} from '@/lib/constants'

interface StatusBadgeProps {
  status: GuideStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white',
        GUIDE_STATUS_COLORS[status],
        className
      )}
    >
      {GUIDE_STATUS_LABELS[status]}
    </span>
  )
}

interface LoteStatusBadgeProps {
  status: string
  className?: string
}

const LOTE_STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-slate-500',
  gerado: 'bg-blue-500',
  enviado: 'bg-amber-500',
  aceito: 'bg-emerald-500',
  glosado: 'bg-red-500',
  pago: 'bg-green-500',
}

const LOTE_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  gerado: 'Gerado',
  enviado: 'Enviado',
  aceito: 'Aceito',
  glosado: 'Glosado',
  pago: 'Pago',
}

export function LoteStatusBadge({ status, className }: LoteStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white',
        LOTE_STATUS_COLORS[status] ?? 'bg-slate-500',
        className
      )}
    >
      {LOTE_STATUS_LABELS[status] ?? status}
    </span>
  )
}
