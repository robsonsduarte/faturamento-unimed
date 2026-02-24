'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, CheckCircle, RotateCw } from 'lucide-react'
import { useGuia, useUpdateGuiaStatus } from '@/hooks/use-guias'
import { useProfile } from '@/hooks/use-profile'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { GUIDE_STATUS_FLOW } from '@/lib/constants'
import type { GuideStatus } from '@/lib/constants'

interface Props {
  params: Promise<{ id: string }>
}

export default function GuiaDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: guia, isLoading, error, refetch } = useGuia(id)
  const updateStatus = useUpdateGuiaStatus()
  const { data: profile } = useProfile()
  const isVisualizador = profile?.role === 'visualizador'
  const [reimporting, setReimporting] = useState(false)
  const [reimportMsg, setReimportMsg] = useState<string | null>(null)

  const handleReimport = async () => {
    if (!guia || reimporting) return
    setReimporting(true)
    setReimportMsg('Atualizando dados da guia...')
    try {
      const res = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_numbers: [guia.guide_number] }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let lastMsg = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter((l) => l.startsWith('data: '))
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.replace('data: ', ''))
              lastMsg = parsed.message ?? ''
            } catch { /* ignore */ }
          }
        }
      }
      setReimportMsg(lastMsg || 'Dados atualizados')
      refetch()
    } catch (err) {
      setReimportMsg(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setReimporting(false)
      setTimeout(() => setReimportMsg(null), 5000)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !guia) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-danger)]">Guia nao encontrada</p>
        <Link href="/dashboard/guias" className="text-sm text-[var(--color-primary)] mt-2 inline-block">
          Voltar para guias
        </Link>
      </div>
    )
  }

  const statusIndex = GUIDE_STATUS_FLOW.indexOf(guia.status as GuideStatus)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Guia ${guia.guide_number}`}
        description={guia.paciente ?? undefined}
        action={
          <Link
            href="/dashboard/guias"
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

      {/* Status pipeline */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Pipeline de Status</h2>
          {isVisualizador && guia.status !== 'COMPLETA' && (
            <button
              onClick={handleReimport}
              disabled={reimporting}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              <RotateCw className={cn('w-3.5 h-3.5', reimporting && 'animate-spin')} />
              {reimporting ? 'Atualizando...' : 'Atualizar dados'}
            </button>
          )}
        </div>
        {reimportMsg && (
          <p className={cn(
            'text-xs mb-3 px-3 py-2 rounded-lg',
            reimporting
              ? 'bg-blue-500/10 text-blue-400'
              : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
          )}>
            {reimportMsg}
          </p>
        )}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {GUIDE_STATUS_FLOW.map((s, i) => {
            const isActive = s === guia.status
            const isDone = i < statusIndex
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                {isVisualizador ? (
                  <span
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium',
                      isActive && 'bg-[var(--color-primary)] text-white',
                      isDone && !isActive && 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
                      !isActive && !isDone && 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                    )}
                  >
                    {isDone && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {s}
                  </span>
                ) : (
                  <button
                    onClick={() => updateStatus.mutate({ id: guia.id, status: s as GuideStatus })}
                    disabled={updateStatus.isPending}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                      isActive && 'bg-[var(--color-primary)] text-white',
                      isDone && !isActive && 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
                      !isActive && !isDone && 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-card)]'
                    )}
                  >
                    {isDone && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {s}
                  </button>
                )}
                {i < GUIDE_STATUS_FLOW.length - 1 && (
                  <div className={cn('w-6 h-0.5', isDone ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados da Guia */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Dados da Guia</h2>
          {[
            { label: 'Numero Operadora', value: guia.guide_number, mono: true },
            { label: 'Numero Prestador', value: guia.guide_number_prestador, mono: true },
            { label: 'Status', value: <StatusBadge status={guia.status as GuideStatus} /> },
            { label: 'Paciente', value: guia.paciente },
            { label: 'Carteira', value: guia.numero_carteira, mono: true },
            { label: 'Senha', value: guia.senha, mono: true },
            { label: 'Data Autorizacao', value: guia.data_autorizacao ? formatDate(guia.data_autorizacao) : null },
            { label: 'Validade Senha', value: guia.data_validade_senha ? formatDate(guia.data_validade_senha) : null },
            { label: 'Qtd Solicitada', value: guia.quantidade_solicitada },
            { label: 'Qtd Autorizada', value: guia.quantidade_autorizada },
            { label: 'Valor Total', value: formatCurrency(guia.valor_total), mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex justify-between items-start gap-2">
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">{label}</span>
              <span className={cn('text-xs text-right', mono ? 'font-mono text-[var(--color-text)]' : 'text-[var(--color-text)]')}>
                {value ?? '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Profissional */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Profissional e Atendimento</h2>
          {[
            { label: 'Profissional', value: guia.nome_profissional },
            { label: 'CNES', value: guia.cnes, mono: true },
            { label: 'Codigo Prestador', value: guia.codigo_prestador, mono: true },
            { label: 'Tipo Atendimento', value: guia.tipo_atendimento },
            { label: 'Indicacao Acidente', value: guia.indicacao_acidente },
            { label: 'Indicacao Clinica', value: guia.indicacao_clinica },
            { label: 'Procs. Realizados', value: guia.procedimentos_realizados },
            { label: 'Procs. Cadastrados', value: guia.procedimentos_cadastrados },
            { label: 'Token Biometrico', value: guia.token_biometrico ? 'Sim' : 'Nao' },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex justify-between items-start gap-2">
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">{label}</span>
              <span className={cn('text-xs text-right', mono ? 'font-mono text-[var(--color-text)]' : 'text-[var(--color-text)]')}>
                {value != null ? String(value) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Procedimentos */}
      {guia.procedimentos && guia.procedimentos.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Procedimentos ({guia.procedimentos.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Seq.', 'Codigo', 'Descricao', 'Data', 'Qtd', 'Valor Unit.', 'Total', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {guia.procedimentos.map((proc) => (
                  <tr key={proc.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-2.5 font-mono">{proc.sequencia}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.codigo_procedimento ?? '—'}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate">{proc.descricao ?? '—'}</td>
                    <td className="px-4 py-2.5">{proc.data_execucao ? formatDate(proc.data_execucao) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.quantidade_executada}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.valor_unitario != null ? formatCurrency(proc.valor_unitario) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.valor_total != null ? formatCurrency(proc.valor_total) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-xs',
                        proc.status === 'Faturado' && 'bg-green-500/20 text-green-400',
                        proc.status === 'Conferido' && 'bg-blue-500/20 text-blue-400',
                        proc.status === 'Importado' && 'bg-slate-500/20 text-slate-400',
                      )}>
                        {proc.status}
                      </span>
                    </td>
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
