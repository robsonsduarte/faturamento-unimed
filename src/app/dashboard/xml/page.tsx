'use client'

import { useState } from 'react'
import { Download, Code2, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useLotes } from '@/hooks/use-lotes'
import { LoteStatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { MonthFilter, getCurrentMonth } from '@/components/shared/month-filter'
import { formatCurrency, cn } from '@/lib/utils'

export default function XmlPage() {
  const [mes, setMes] = useState(getCurrentMonth())
  const { data } = useLotes({ pageSize: 100, mes: mes !== 'todos' ? mes : undefined })
  const lotes = data?.data ?? []
  const [selectedLoteId, setSelectedLoteId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewXml, setPreviewXml] = useState('')

  const selectedLote = lotes.find((l) => l.id === selectedLoteId)

  async function handleGerarXml() {
    if (!selectedLoteId) { toast.error('Selecione um lote'); return }
    setGenerating(true)
    try {
      const res = await fetch(`/api/lotes/${selectedLoteId}/gerar-xml`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      const data = await res.json() as { xml: string }
      setPreviewXml(data.xml ?? '')
      toast.success('XML TISS gerado com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar XML')
    } finally {
      setGenerating(false)
    }
  }

  function handleDownload() {
    if (!previewXml || !selectedLote) return
    const blob = new Blob([previewXml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tiss-lote-${selectedLote.numero_lote}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerador XML TISS"
        description="Gere o XML no padrao TISS 4.02.00 para envio a Unimed"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Selecionar Lote</h2>
              <MonthFilter value={mes} onChange={(v) => { setMes(v); setSelectedLoteId(''); setPreviewXml('') }} />
            </div>

            <select
              value={selectedLoteId}
              onChange={(e) => { setSelectedLoteId(e.target.value); setPreviewXml('') }}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-sm text-[var(--color-text)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              <option value="">-- Selecione um lote --</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.numero_lote} — {l.referencia ?? 'sem ref'} ({l.quantidade_guias} guias)
                </option>
              ))}
            </select>

            {selectedLote && (
              <div className="space-y-2 pt-2 border-t border-[var(--color-border)]">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Status</span>
                  <LoteStatusBadge status={selectedLote.status} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Guias</span>
                  <span className="font-mono text-[var(--color-text)]">{selectedLote.quantidade_guias}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Valor Total</span>
                  <span className="font-mono text-[var(--color-primary)]">{formatCurrency(selectedLote.valor_total)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">XML Gerado</span>
                  <span className={selectedLote.xml_content ? 'text-[var(--color-success)]' : 'text-[var(--color-text-muted)]'}>
                    {selectedLote.xml_content ? 'Sim' : 'Nao'}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={handleGerarXml}
              disabled={!selectedLoteId || generating}
              className={cn(
                'w-full py-2.5 rounded-lg font-medium text-sm text-white flex items-center justify-center gap-2',
                'bg-[var(--color-secondary)] hover:opacity-90 transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-secondary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code2 className="w-4 h-4" />}
              Gerar XML TISS
            </button>

            {previewXml && (
              <button
                onClick={handleDownload}
                className={cn(
                  'w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2',
                  'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                <Download className="w-4 h-4" />
                Download XML
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden h-full">
            <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--color-text-muted)]" />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Preview XML</h2>
            </div>
            {!previewXml ? (
              <EmptyState
                title="Nenhum XML gerado"
                description="Selecione um lote e clique em Gerar XML TISS para visualizar o preview."
              />
            ) : (
              <pre className="p-5 text-xs font-mono text-[var(--color-text-muted)] overflow-auto max-h-[600px] whitespace-pre-wrap break-all">
                {previewXml}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
