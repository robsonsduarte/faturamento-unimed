'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Fingerprint, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getTokens } from '@/lib/services/tokens'
import { tokenValidarSchema, type TokenValidarInput } from '@/lib/validations/token'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { MonthFilter, getCurrentMonth } from '@/components/shared/month-filter'
import { formatDateTime, cn } from '@/lib/utils'

export default function TokensPage() {
  const [validating, setValidating] = useState(false)
  const [mes, setMes] = useState(getCurrentMonth())

  const { data: tokens, isLoading, refetch } = useQuery({
    queryKey: ['tokens', mes],
    queryFn: () => getTokens(mes !== 'todos' ? mes : undefined),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TokenValidarInput>({ resolver: zodResolver(tokenValidarSchema) })

  async function onSubmit(values: TokenValidarInput) {
    setValidating(true)
    try {
      const res = await fetch('/api/tokens/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      toast.success('Token validado com sucesso')
      reset()
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao validar token')
    } finally {
      setValidating(false)
    }
  }

  const lista = tokens ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Validacao Biometrica"
        description="Validar token biometrico do paciente"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Validar Token</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {[
              { name: 'guia_id' as const, label: 'ID da Guia (UUID)', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
              { name: 'paciente_nome' as const, label: 'Nome do Paciente', placeholder: 'Nome completo' },
              { name: 'numero_carteira' as const, label: 'Numero da Carteira', placeholder: '0000 0000 0000 0' },
              { name: 'token' as const, label: 'Token Biometrico', placeholder: 'Token recebido' },
            ].map(({ name, label, placeholder }) => (
              <div key={name}>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">{label}</label>
                <input
                  {...register(name)}
                  placeholder={placeholder}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                    errors[name] ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'
                  )}
                />
                {errors[name] && (
                  <p className="mt-1 text-xs text-[var(--color-danger)]">{errors[name]?.message}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={validating}
              className={cn(
                'w-full py-2.5 rounded-lg font-medium text-sm text-white flex items-center justify-center gap-2',
                'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Validar Token
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Historico de Validacoes</h2>
              <MonthFilter value={mes} onChange={setMes} />
            </div>
            {isLoading && <div className="p-6"><TableSkeleton rows={4} /></div>}
            {!isLoading && lista.length === 0 && (
              <EmptyState icon={Fingerprint} title="Nenhuma validacao registrada" />
            )}
            {!isLoading && lista.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {['Paciente', 'Carteira', 'Token', 'Validado', 'Data'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {lista.map((t) => (
                      <tr key={t.id} className="hover:bg-[var(--color-surface)]">
                        <td className="px-4 py-2.5">{t.paciente_nome ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono">{t.numero_carteira ?? '—'}</td>
                        <td className="px-4 py-2.5 font-mono truncate max-w-[100px]">{t.token}</td>
                        <td className="px-4 py-2.5">
                          {t.validado
                            ? <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
                            : <XCircle className="w-4 h-4 text-[var(--color-danger)]" />
                          }
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                          {t.data_validacao ? formatDateTime(t.data_validacao) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
