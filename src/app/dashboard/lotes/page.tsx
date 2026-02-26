'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useLotes } from '@/hooks/use-lotes'
import { LoteStatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'

export default function LotesPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useLotes({
    status: status || undefined,
    page,
    pageSize: 20,
  })

  const lotes = data?.data ?? []
  const total = data?.count ?? 0

  async function handleDelete(loteId: string, numeroLote: string) {
    if (!confirm(`Excluir lote ${numeroLote}? As guias serao liberadas e voltarao ao estado anterior.`)) return
    setDeleting(loteId)
    try {
      const res = await fetch(`/api/lotes/${loteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      const result = await res.json() as { guias_liberadas: number }
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['guias'] })
      toast.success(`Lote ${numeroLote} excluido. ${result.guias_liberadas} guia(s) liberada(s).`)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir lote')
    } finally {
      setDeleting(null)
    }
  }

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
          {[
            { value: 'rascunho',   label: 'Rascunho'   },
            { value: 'gerado',     label: 'Gerado'      },
            { value: 'enviado',    label: 'Enviado'     },
            { value: 'aceito',     label: 'Aceito'      },
            { value: 'processado', label: 'Processado'  },
            { value: 'faturado',   label: 'Faturado'    },
            { value: 'glosado',    label: 'Glosado'     },
            { value: 'pago',       label: 'Pago'        },
          ].map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
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
                  {['Numero Lote', 'Tipo', 'Referencia', 'Guias', 'Valor Total', 'Status', 'Fatura/NF', 'Criado em', ''].map((h) => (
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
                    <td className="px-4 py-3 font-mono text-xs text-green-400">
                      {lote.numero_fatura ?? <span className="text-[var(--color-text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDateTime(lote.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
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
                        {['rascunho', 'gerado'].includes(lote.status) && (
                          <button
                            onClick={() => handleDelete(lote.id, lote.numero_lote)}
                            disabled={deleting === lote.id}
                            title="Excluir lote"
                            className={cn(
                              'p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
