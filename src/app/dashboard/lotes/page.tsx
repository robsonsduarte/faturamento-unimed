'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw } from 'lucide-react'
import { useLotes } from '@/hooks/use-lotes'
import { LoteStatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'

export default function LotesPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useLotes({
    status: status || undefined,
    page,
    pageSize: 20,
  })

  const lotes = data?.data ?? []
  const total = data?.count ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lotes de Faturamento"
        description={`${total} lote${total !== 1 ? 's' : ''}`}
        action={
          <Link
            href="/dashboard/lotes/novo"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
            )}
          >
            <Plus className="w-4 h-4" />
            Novo Lote
          </Link>
        }
      />

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
          {['rascunho', 'gerado', 'enviado', 'aceito', 'glosado', 'pago'].map((s) => (
            <option key={s} value={s}>{s}</option>
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
        {isLoading && <div className="p-6"><TableSkeleton rows={5} /></div>}
        {error && <div className="p-6 text-sm text-[var(--color-danger)]">Erro: {error.message}</div>}
        {!isLoading && !error && lotes.length === 0 && (
          <EmptyState title="Nenhum lote encontrado" description="Crie um novo lote de faturamento." />
        )}
        {!isLoading && !error && lotes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Numero Lote', 'Tipo', 'Referencia', 'Guias', 'Valor Total', 'Status', 'Criado em', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {lotes.map((lote) => (
                  <tr key={lote.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{lote.numero_lote}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{lote.tipo}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{lote.referencia ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{lote.quantidade_guias}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatCurrency(lote.valor_total)}</td>
                    <td className="px-4 py-3"><LoteStatusBadge status={lote.status} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDateTime(lote.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/lotes/${lote.id}`}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs',
                          'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                        )}
                      >
                        Ver
                      </Link>
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
