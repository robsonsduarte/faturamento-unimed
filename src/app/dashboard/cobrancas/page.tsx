'use client'

import { useState } from 'react'
import { Plus, RefreshCw, DollarSign } from 'lucide-react'
import { useCobrancas, useCobrancasResumo } from '@/hooks/use-cobrancas'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton, Skeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

const COBRANCA_STATUS_COLORS: Record<string, string> = {
  pendente: 'bg-slate-500',
  enviada: 'bg-blue-500',
  paga: 'bg-green-500',
  glosada: 'bg-red-500',
  recurso: 'bg-amber-500',
}

const COBRANCA_STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  enviada: 'Enviada',
  paga: 'Paga',
  glosada: 'Glosada',
  recurso: 'Recurso',
}

export default function CobrancasPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useCobrancas({
    status: status || undefined,
    page,
    pageSize: 20,
  })
  const { data: resumo, isLoading: resumoLoading } = useCobrancasResumo()

  const cobrancas = data?.data ?? []
  const total = data?.count ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobrancas"
        description={`${total} cobranca${total !== 1 ? 's' : ''}`}
      />

      {/* Resumo financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {resumoLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : resumo && [
            { label: 'Total Cobrado', value: formatCurrency(resumo.total_cobrado), color: 'text-[var(--color-text)]' },
            { label: 'Total Pago', value: formatCurrency(resumo.total_pago), color: 'text-[var(--color-success)]' },
            { label: 'Total Glosado', value: formatCurrency(resumo.total_glosado), color: 'text-[var(--color-danger)]' },
            { label: 'Pendentes', value: resumo.total_pendente, color: 'text-[var(--color-warning)]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
              <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
              <p className={cn('text-xl font-bold font-mono mt-1', color)}>{value}</p>
            </div>
          ))
        }
      </div>

      <div className="flex gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className={cn(
            'px-3 py-2.5 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)]',
            'text-sm text-[var(--color-text)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
          )}
        >
          <option value="">Todos os status</option>
          {Object.keys(COBRANCA_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>{COBRANCA_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button
          onClick={() => refetch()}
          className={cn(
            'p-2.5 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)]',
            'text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
          )}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading && <div className="p-6"><TableSkeleton rows={6} /></div>}
        {error && <div className="p-6 text-sm text-[var(--color-danger)]">Erro: {error.message}</div>}
        {!isLoading && !error && cobrancas.length === 0 && (
          <EmptyState icon={DollarSign} title="Nenhuma cobranca encontrada" />
        )}
        {!isLoading && !error && cobrancas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Tipo', 'Cobrado', 'Pago', 'Glosado', 'Motivo Glosa', 'Data Cobranca', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {cobrancas.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-3 text-xs capitalize">{c.tipo.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.valor_cobrado != null ? formatCurrency(c.valor_cobrado) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-success)]">{c.valor_pago != null ? formatCurrency(c.valor_pago) : '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-danger)]">{c.valor_glosado != null ? formatCurrency(c.valor_glosado) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] max-w-[200px] truncate">{c.motivo_glosa ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{c.data_cobranca ? formatDate(c.data_cobranca) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium text-white', COBRANCA_STATUS_COLORS[c.status] ?? 'bg-slate-500')}>
                        {COBRANCA_STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
