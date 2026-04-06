'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useGuias } from '@/hooks/use-guias'
import { MonthSelect } from '@/components/shared/month-select'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, cn } from '@/lib/utils'
import { getCurrentMonth } from '@/lib/month-utils'

interface LoteForm {
  numero_lote: string
  tipo: 'Local' | 'Externo'
  referencia: string
  observacoes: string
}

export default function NovoLotePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedGuias, setSelectedGuias] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  // Override de valor unitario por guia (guia.id -> valor unitario)
  const [valorOverrides, setValorOverrides] = useState<Record<string, number>>({})
  const [form, setForm] = useState<LoteForm>({
    numero_lote: '',
    tipo: 'Local',
    referencia: getCurrentMonth(),
    observacoes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof LoteForm, string>>>({})

  // Fetch guides filtered by tipo from API: Local→Local, Externo→Intercambio
  const tipoGuiaFilter = form.tipo === 'Local' ? 'Local' : 'Intercambio'
  const { data: guiasData } = useGuias({ status: 'COMPLETA', tipo_guia: tipoGuiaFilter, sem_lote: true, pageSize: 100 })
  const guias = guiasData?.data ?? []

  // Helpers para extrair dados do procedimento
  function getCodigoProc(g: (typeof guias)[number]): string {
    const sawData = g.saw_data as Record<string, unknown> | null
    return (sawData?.['codigoProcedimentoSolicitado'] as string) ?? '—'
  }

  function getValorUnitario(g: (typeof guias)[number]): number {
    if (valorOverrides[g.id] != null) return valorOverrides[g.id]
    const qtd = g.quantidade_autorizada ?? g.procedimentos_realizados ?? 1
    return qtd > 0 ? Math.round((g.valor_total / qtd) * 100) / 100 : g.valor_total
  }

  function getValorTotal(g: (typeof guias)[number]): number {
    if (valorOverrides[g.id] != null) {
      const qtd = g.quantidade_autorizada ?? g.procedimentos_realizados ?? 1
      return Math.round(valorOverrides[g.id] * qtd * 100) / 100
    }
    return g.valor_total
  }

  function handleValorUnitarioChange(guiaId: string, qtd: number, newVal: string) {
    const parsed = parseFloat(newVal.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= 0) {
      setValorOverrides((prev) => ({ ...prev, [guiaId]: parsed }))
    }
  }

  function toggleGuia(id: string) {
    setSelectedGuias((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalSelecionado = guias
    .filter((g) => selectedGuias.has(g.id))
    .reduce((acc, g) => acc + getValorTotal(g), 0)

  function validate(): boolean {
    const errs: Partial<Record<keyof LoteForm, string>> = {}
    if (!form.numero_lote.trim()) errs.numero_lote = 'Numero do lote obrigatorio'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    if (selectedGuias.size === 0) {
      toast.error('Selecione ao menos uma guia')
      return
    }
    setLoading(true)
    try {
      // Atualizar valor_total das guias que tiveram override de valor unitario
      const overrideEntries = Object.entries(valorOverrides).filter(([id]) => selectedGuias.has(id))
      for (const [guiaId, valorUnit] of overrideEntries) {
        const g = guias.find((x) => x.id === guiaId)
        if (!g) continue
        const qtd = g.quantidade_autorizada ?? g.procedimentos_realizados ?? 1
        const novoTotal = Math.round(valorUnit * qtd * 100) / 100
        await fetch(`/api/guias/${guiaId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor_total: novoTotal }),
        })
      }

      const response = await fetch('/api/lotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          guia_ids: Array.from(selectedGuias),
        }),
      })
      if (!response.ok) {
        const err = await response.json() as { error: string }
        throw new Error(err.error)
      }
      const lote = await response.json() as { id: string }
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      toast.success('Lote criado com sucesso')
      router.push(`/dashboard/lotes/${lote.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novo Lote de Faturamento"
        action={
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
        }
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Dados do Lote</h2>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Numero do Lote</label>
              <input
                value={form.numero_lote}
                onChange={(e) => setForm((p) => ({ ...p, numero_lote: e.target.value }))}
                placeholder="Ex: 20260201"
                className={cn(
                  'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  errors.numero_lote ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                )}
              />
              {errors.numero_lote && (
                <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.numero_lote}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => {
                  setForm((p) => ({ ...p, tipo: e.target.value as 'Local' | 'Externo' }))
                  setSelectedGuias(new Set())
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                <option value="Local">Local</option>
                <option value="Externo">Intercambio</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Referencia (mes/ano)</label>
              <MonthSelect
                value={form.referencia}
                onChange={(v) => setForm((p) => ({ ...p, referencia: v }))}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Observacoes</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                rows={3}
                className={cn(
                  'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] resize-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              />
            </div>

            <div className="pt-2 border-t border-[var(--color-border)]">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-[var(--color-text-muted)]">Guias selecionadas:</span>
                <span className="font-mono font-bold text-[var(--color-text)]">{selectedGuias.size}</span>
              </div>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-[var(--color-text-muted)]">Valor total:</span>
                <span className="font-mono font-bold text-[var(--color-primary)]">{formatCurrency(totalSelecionado)}</span>
              </div>

              <button
                type="submit"
                disabled={loading || selectedGuias.size === 0}
                className={cn(
                  'w-full py-2.5 rounded-lg font-medium text-sm text-white flex items-center justify-center gap-2',
                  'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar Lote
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Guias Disponiveis ({form.tipo === 'Local' ? 'Local' : 'Intercambio'}) — {guias.length}
              </h2>
            </div>
            {guias.length === 0 ? (
              <div className="p-6 text-sm text-[var(--color-text-muted)]">
                Nenhuma guia com status COMPLETA disponivel para faturamento.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-4 py-2.5 text-left">
                        <input
                          type="checkbox"
                          checked={selectedGuias.size === guias.length && guias.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedGuias(new Set(guias.map((g) => g.id)))
                            else setSelectedGuias(new Set())
                          }}
                          className="rounded"
                        />
                      </th>
                      {['Numero Guia', 'Paciente', 'Proc.', 'V. Unit', 'Qtd', 'Valor Total'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {guias.map((g) => (
                      <tr
                        key={g.id}
                        onClick={() => toggleGuia(g.id)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          selectedGuias.has(g.id) ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-surface)]'
                        )}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedGuias.has(g.id)}
                            onChange={() => toggleGuia(g.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-2.5 font-mono">{g.guide_number}</td>
                        <td className="px-4 py-2.5 max-w-[180px] truncate">{g.paciente ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono text-[var(--color-text-muted)]">{getCodigoProc(g)}</td>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={getValorUnitario(g).toFixed(2).replace('.', ',')}
                            onChange={(e) => handleValorUnitarioChange(g.id, g.quantidade_autorizada ?? 1, e.target.value)}
                            className={cn(
                              'w-[80px] px-2 py-1 rounded text-xs font-mono text-right',
                              'bg-[var(--color-surface)] border text-[var(--color-text)]',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                              valorOverrides[g.id] != null
                                ? 'border-[var(--color-primary)]'
                                : 'border-[var(--color-border)]'
                            )}
                          />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-center">{g.quantidade_autorizada ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono">{formatCurrency(getValorTotal(g))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
