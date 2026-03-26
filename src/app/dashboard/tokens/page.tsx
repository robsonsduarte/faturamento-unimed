'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Fingerprint, CheckCircle, XCircle, Clock, MessageSquare, Camera, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getTokens } from '@/lib/services/tokens'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { MonthFilter, getCurrentMonth } from '@/components/shared/month-filter'
import { formatDateTime, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface GuiaToken {
  id: string
  guide_number: string
  paciente: string | null
  numero_carteira: string | null
  status: string
  token_biometrico: boolean
  data_token: string | null
  updated_at: string
}

export default function TokensPage() {
  const [mes, setMes] = useState(getCurrentMonth())

  // Guias com status TOKEN (pendentes de resolucao)
  const { data: guiasToken, isLoading: loadingGuias } = useQuery({
    queryKey: ['guias-token'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('guias')
        .select('id, guide_number, paciente, numero_carteira, status, token_biometrico, data_token, updated_at')
        .eq('status', 'TOKEN')
        .order('updated_at', { ascending: false })
      return (data ?? []) as GuiaToken[]
    },
  })

  // Guias com token resolvido (token_biometrico = true, qualquer status)
  const { data: guiasResolvidas, isLoading: loadingResolvidas } = useQuery({
    queryKey: ['guias-token-resolvidas', mes],
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('guias')
        .select('id, guide_number, paciente, numero_carteira, status, token_biometrico, data_token, updated_at')
        .eq('token_biometrico', true)
        .order('data_token', { ascending: false })
        .limit(50)

      if (mes !== 'todos') {
        const [year, month] = mes.split('-')
        const start = `${year}-${month}-01`
        const endDate = new Date(parseInt(year), parseInt(month), 0)
        const end = `${year}-${month}-${endDate.getDate()}`
        query = query.gte('data_token', start).lte('data_token', `${end}T23:59:59`)
      }

      const { data } = await query
      return (data ?? []) as GuiaToken[]
    },
  })

  // Historico de validacoes manuais
  const { data: tokens, isLoading: loadingTokens } = useQuery({
    queryKey: ['tokens', mes],
    queryFn: () => getTokens(mes !== 'todos' ? mes : undefined),
  })

  const pendentes = guiasToken ?? []
  const resolvidas = guiasResolvidas ?? []
  const validacoes = tokens ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tokens e Biometria"
        description="Gestao de tokens de atendimento e biometria facial"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pendentes', value: pendentes.length, color: 'var(--color-warning)', icon: Clock },
          { label: 'Resolvidos', value: resolvidas.length, color: 'var(--color-success)', icon: CheckCircle },
          { label: 'Via WhatsApp', value: validacoes.filter((t) => t.token?.length === 6).length, color: '#25d366', icon: MessageSquare },
          { label: 'Via Biometria', value: validacoes.filter((t) => t.token && t.token.length > 6).length, color: 'var(--color-secondary)', icon: Camera },
        ].map(({ label, value, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border p-4"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
              </div>
              <Icon className="w-8 h-8 opacity-20" style={{ color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Guias pendentes de token */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-warning)', background: 'var(--color-card)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.06)' }}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: 'var(--color-warning)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
              Guias Pendentes de Token ({pendentes.length})
            </h2>
          </div>
        </div>
        {loadingGuias && <div className="p-6"><TableSkeleton rows={3} /></div>}
        {!loadingGuias && pendentes.length === 0 && (
          <EmptyState icon={CheckCircle} title="Nenhuma guia pendente de token" />
        )}
        {!loadingGuias && pendentes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Guia', 'Paciente', 'Carteira', 'Atualizado', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pendentes.map((g) => (
                  <tr key={g.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{g.guide_number}</td>
                    <td className="px-4 py-2.5">{g.paciente ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-[var(--color-text-muted)]">{g.numero_carteira ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{formatDateTime(g.updated_at)}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/guias/${g.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-1 transition-colors"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        Resolver <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tokens resolvidos */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Tokens Resolvidos ({resolvidas.length})
            </h2>
          </div>
          <MonthFilter value={mes} onChange={setMes} />
        </div>
        {loadingResolvidas && <div className="p-6"><TableSkeleton rows={4} /></div>}
        {!loadingResolvidas && resolvidas.length === 0 && (
          <EmptyState icon={Fingerprint} title="Nenhum token resolvido neste periodo" />
        )}
        {!loadingResolvidas && resolvidas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Guia', 'Paciente', 'Status', 'Resolvido em', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {resolvidas.map((g) => (
                  <tr key={g.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-2.5 font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{g.guide_number}</td>
                    <td className="px-4 py-2.5">{g.paciente ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          g.status === 'COMPLETA' && 'bg-emerald-500/15 text-emerald-400',
                          g.status === 'PENDENTE' && 'bg-slate-500/15 text-slate-400',
                          g.status === 'CPRO' && 'bg-blue-500/15 text-blue-400',
                          g.status === 'TOKEN' && 'bg-amber-500/15 text-amber-400',
                          g.status === 'PROCESSADA' && 'bg-sky-500/15 text-sky-400',
                          g.status === 'FATURADA' && 'bg-green-500/15 text-green-400',
                        )}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                      {g.data_token ? formatDateTime(g.data_token) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/guias/${g.id}`}
                        className="text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Ver guia
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historico de validacoes manuais */}
      {!loadingTokens && validacoes.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Validacoes Manuais ({validacoes.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Paciente', 'Carteira', 'Token', 'Status', 'Data'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {validacoes.map((t) => (
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
        </div>
      )}
    </div>
  )
}
