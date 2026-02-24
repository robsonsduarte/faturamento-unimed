'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Code2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLote } from '@/hooks/use-lotes'
import { LoteStatusBadge, StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import type { GuideStatus } from '@/lib/constants'

interface Props {
  params: Promise<{ id: string }>
}

export default function LoteDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: lote, isLoading, error, refetch } = useLote(id)
  const [generating, setGenerating] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !lote) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-danger)]">Lote nao encontrado</p>
        <Link href="/dashboard/lotes" className="text-sm text-[var(--color-primary)] mt-2 inline-block">
          Voltar para lotes
        </Link>
      </div>
    )
  }

  async function handleGerarXml() {
    setGenerating(true)
    try {
      const response = await fetch(`/api/lotes/${id}/gerar-xml`, { method: 'POST' })
      if (!response.ok) {
        const err = await response.json() as { error: string }
        throw new Error(err.error)
      }
      await refetch()
      toast.success('XML TISS gerado com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar XML')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownloadXml() {
    if (!lote) return
    const response = await fetch(`/api/lotes/${id}/download-xml`)
    if (!response.ok) { toast.error('Erro ao baixar XML'); return }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lote-${lote.numero_lote}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lote ${lote.numero_lote}`}
        action={
          <div className="flex gap-2">
            <button
              onClick={handleGerarXml}
              disabled={generating}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-[var(--color-secondary)] text-white hover:opacity-90 transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code2 className="w-4 h-4" />}
              Gerar XML
            </button>
            {lote.xml_content && (
              <button
                onClick={handleDownloadXml}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                <Download className="w-4 h-4" />
                Download XML
              </button>
            )}
            <Link
              href="/dashboard/lotes"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {([
          { label: 'Status', value: <LoteStatusBadge status={lote.status} /> },
          { label: 'Tipo', value: lote.tipo },
          { label: 'Referencia', value: lote.referencia ?? '—' },
          { label: 'Quantidade de Guias', value: String(lote.quantidade_guias) },
          { label: 'Valor Total', value: formatCurrency(lote.valor_total) },
          { label: 'XML gerado', value: lote.xml_content ? 'Sim' : 'Nao' },
        ] as { label: string; value: React.ReactNode }[]).map(({ label, value }) => (
          <div key={label} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
            <div className="text-sm font-medium text-[var(--color-text)]">{value}</div>
          </div>
        ))}
      </div>

      {lote.guias && lote.guias.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Guias no Lote ({lote.guias.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Numero Guia', 'Paciente', 'Data Aut.', 'Status', 'Valor'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {lote.guias.map((g) => (
                  <tr key={g.id} className="hover:bg-[var(--color-surface)]">
                    <td className="px-4 py-2.5 font-mono">{g.guide_number}</td>
                    <td className="px-4 py-2.5">{g.paciente ?? '—'}</td>
                    <td className="px-4 py-2.5">{g.data_autorizacao ? formatDate(g.data_autorizacao) : '—'}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={g.status as GuideStatus} /></td>
                    <td className="px-4 py-2.5 font-mono">{formatCurrency(g.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
