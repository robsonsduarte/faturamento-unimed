'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useGuias } from '@/hooks/use-guias'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, cn } from '@/lib/utils'
import type { GuideStatus } from '@/lib/constants'

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
  const [form, setForm] = useState<LoteForm>({
    numero_lote: '',
    tipo: 'Local',
    referencia: '',
    observacoes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof LoteForm, string>>>({})

  const { data: guiasData } = useGuias({ status: 'COMPLETA', pageSize: 100 })
  const allGuias = guiasData?.data ?? []

  // Filter guides by selected lote tipo: Local shows Local, Externo shows Intercambio
  const guias = allGuias.filter((g) => {
    if (form.tipo === 'Local') return g.tipo_guia === 'Local'
    return g.tipo_guia === 'Intercambio' || !g.tipo_guia
  })

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
    .reduce((acc, g) => acc + g.valor_total, 0)

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
                <option value="Externo">Externo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Referencia (mes/ano)</label>
              <input
                value={form.referencia}
                onChange={(e) => setForm((p) => ({ ...p, referencia: e.target.value }))}
                placeholder="2026-02"
                className={cn(
                  'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
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
                      {['Numero Guia', 'Paciente', 'Tipo', 'Status', 'Valor'].map((h) => (
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
                        <td className="px-4 py-2.5">{g.paciente ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-xs font-medium',
                            g.tipo_guia === 'Local' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
                          )}>
                            {g.tipo_guia ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={g.status as GuideStatus} /></td>
                        <td className="px-4 py-2.5 font-mono">{formatCurrency(g.valor_total)}</td>
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
