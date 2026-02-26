'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Code2, Loader2, CheckCircle, Receipt } from 'lucide-react'
import { toast } from 'sonner'
import { useLote, useUpdateLoteStatus } from '@/hooks/use-lotes'
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
  const updateStatus = useUpdateLoteStatus()
  const [generating, setGenerating] = useState(false)
  const [showFaturaInput, setShowFaturaInput] = useState(false)
  const [numeroFatura, setNumeroFatura] = useState('')

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

  async function handleMarcarProcessado() {
    updateStatus.mutate(
      { id, status: 'processado' },
      {
        onSuccess: async (result) => {
          await refetch()
          toast.success(`Lote marcado como Processado. ${result.guias_atualizadas} guia(s) atualizada(s).`)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
        },
      }
    )
  }

  async function handleMarcarFaturado() {
    if (!numeroFatura.trim()) {
      toast.error('Informe o numero da fatura/NF')
      return
    }
    updateStatus.mutate(
      { id, status: 'faturado', numeroFatura: numeroFatura.trim() },
      {
        onSuccess: async (result) => {
          await refetch()
          setShowFaturaInput(false)
          setNumeroFatura('')
          toast.success(`Lote marcado como Faturado. ${result.guias_atualizadas} guia(s) atualizada(s).`)
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status')
        },
      }
    )
  }

  const canMarkProcessado = ['gerado', 'enviado', 'aceito'].includes(lote.status)
  const canMarkFaturado = lote.status === 'processado'
  const isMutating = updateStatus.isPending

  const infoCards: { label: string; value: React.ReactNode }[] = [
    { label: 'Status', value: <LoteStatusBadge status={lote.status} /> },
    { label: 'Tipo', value: lote.tipo },
    { label: 'Referencia', value: lote.referencia ?? '—' },
    { label: 'Quantidade de Guias', value: String(lote.quantidade_guias) },
    { label: 'Valor Total', value: formatCurrency(lote.valor_total) },
    { label: 'XML gerado', value: lote.xml_content ? 'Sim' : 'Nao' },
  ]

  if (lote.status === 'faturado' && lote.numero_fatura) {
    infoCards.push({
      label: 'Fatura/NF',
      value: (
        <span className="font-mono text-green-400 font-semibold">{lote.numero_fatura}</span>
      ),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lote ${lote.numero_lote}`}
        action={
          <div className="flex flex-wrap gap-2">
            {canMarkProcessado && (
              <button
                onClick={handleMarcarProcessado}
                disabled={isMutating}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-sky-600 text-white hover:bg-sky-700 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isMutating
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <CheckCircle className="w-4 h-4" />
                }
                {isMutating ? 'Processando...' : 'Marcar como Processado'}
              </button>
            )}

            {canMarkFaturado && !showFaturaInput && (
              <button
                onClick={() => setShowFaturaInput(true)}
                disabled={isMutating}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-green-600 text-white hover:bg-green-700 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <Receipt className="w-4 h-4" />
                Marcar como Faturado
              </button>
            )}

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

      {canMarkFaturado && showFaturaInput && (
        <div className="bg-[var(--color-card)] border border-green-700/50 rounded-xl p-4">
          <p className="text-sm font-medium text-[var(--color-text)] mb-3">
            Informe o numero da Fatura/NF para confirmar o faturamento:
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <label htmlFor="numero-fatura" className="block text-xs text-[var(--color-text-muted)] mb-1">
                Numero da Fatura/NF
              </label>
              <input
                id="numero-fatura"
                type="text"
                value={numeroFatura}
                onChange={(e) => setNumeroFatura(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleMarcarFaturado() }}
                placeholder="Ex: NF-2026001"
                autoFocus
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                  'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'
                )}
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleMarcarFaturado}
                disabled={isMutating || !numeroFatura.trim()}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-green-600 text-white hover:bg-green-700 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isMutating
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Receipt className="w-4 h-4" />
                }
                {isMutating ? 'Salvando...' : 'Confirmar Faturamento'}
              </button>
              <button
                onClick={() => { setShowFaturaInput(false); setNumeroFatura('') }}
                disabled={isMutating}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {infoCards.map(({ label, value }) => (
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
