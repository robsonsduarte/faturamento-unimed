'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, RefreshCw } from 'lucide-react'
import { useGuias } from '@/hooks/use-guias'
import { useProfile } from '@/hooks/use-profile'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { GUIDE_STATUS_FLOW, GUIDE_STATUS_LABELS } from '@/lib/constants'
import type { GuideStatus } from '@/lib/constants'

export default function GuiasPage() {
  const { data: profile } = useProfile()
  const isVisualizador = profile?.role === 'visualizador'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useGuias({
    search: search || undefined,
    status: status || undefined,
    page,
    pageSize: 20,
  })

  const guias = data?.data ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guias"
        description={`${total} guia${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`}
        action={
          !isVisualizador ? (
            <div className="flex gap-2">
              <Link
                href="/dashboard/guias/importar?mode=pendentes"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-muted)]',
                  'hover:text-[var(--color-text)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Re-importar Pendentes
              </Link>
              <Link
                href="/dashboard/guias/importar"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                <Plus className="w-4 h-4" />
                Importar Guias
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Buscar por numero, paciente, carteira..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className={cn(
              'w-full pl-9 pr-4 py-2.5 rounded-lg bg-[var(--color-card)] border border-[var(--color-border)]',
              'text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
            )}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
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
            {GUIDE_STATUS_FLOW.map((s) => (
              <option key={s} value={s}>{GUIDE_STATUS_LABELS[s]}</option>
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
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading && (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        )}

        {error && (
          <div className="p-6 text-sm text-[var(--color-danger)]">
            Erro ao carregar guias: {error.message}
          </div>
        )}

        {!isLoading && !error && guias.length === 0 && (
          <EmptyState
            title="Nenhuma guia encontrada"
            description="Importe guias do SAW ou ajuste os filtros de busca."
          />
        )}

        {!isLoading && !error && guias.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Numero Guia', 'Paciente', 'Carteira', 'Tipo', 'Data Aut.', 'Status', 'Valor', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {guias.map((guia) => {
                  const isCancelada = guia.status === 'CANCELADA'
                  return (
                  <tr key={guia.id} className={cn('hover:bg-[var(--color-surface)] transition-colors', isCancelada && 'opacity-50')}>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text)]">
                      <span className={cn(isCancelada && 'line-through')}>{guia.guide_number}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text)] max-w-[200px] truncate">
                      <span className={cn(isCancelada && 'line-through')}>{guia.paciente ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
                      {guia.numero_carteira ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-xs font-medium',
                        guia.tipo_guia === 'Local' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
                      )}>
                        {guia.tipo_guia ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {guia.data_autorizacao ? formatDate(guia.data_autorizacao) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={guia.status as GuideStatus} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text)]">
                      {formatCurrency(guia.valor_total)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/guias/${guia.id}`}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium',
                          'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                        )}
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-muted)]">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm bg-[var(--color-card)] border border-[var(--color-border)]',
                'text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm bg-[var(--color-card)] border border-[var(--color-border)]',
                'text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
