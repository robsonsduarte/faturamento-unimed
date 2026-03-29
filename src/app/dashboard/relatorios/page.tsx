'use client'

import { useState } from 'react'
import {
  BarChart3,
  DollarSign,
  FileText,
  Package,
  AlertTriangle,
  Ban,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { MonthFilter, getCurrentMonth } from '@/components/shared/month-filter'
import { useReportData } from '@/hooks/use-reports'
import { formatCurrency } from '@/lib/utils'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import {
  GUIDE_STATUS_FLOW,
  GUIDE_STATUS_LABELS,
  LOTE_STATUS_FLOW,
  LOTE_STATUS_LABELS,
} from '@/lib/constants'
import type { GuideStatus, LoteStatus } from '@/lib/constants'

const GUIDE_STATUS_TEXT_COLORS: Record<GuideStatus, string> = {
  PENDENTE: 'text-slate-400',
  CPRO: 'text-blue-400',
  TOKEN: 'text-amber-400',
  COMPLETA: 'text-emerald-400',
  PROCESSADA: 'text-sky-400',
  FATURADA: 'text-green-400',
  CANCELADA: 'text-red-400',
  NEGADA: 'text-orange-400',
}

const GUIDE_STATUS_BAR_COLORS: Record<GuideStatus, string> = {
  PENDENTE: 'bg-slate-500',
  CPRO: 'bg-blue-500',
  TOKEN: 'bg-amber-500',
  COMPLETA: 'bg-emerald-500',
  PROCESSADA: 'bg-sky-500',
  FATURADA: 'bg-green-500',
  NEGADA: 'bg-orange-600',
  CANCELADA: 'bg-red-500',
}

const LOTE_STATUS_TEXT_COLORS: Record<LoteStatus, string> = {
  rascunho: 'text-slate-400',
  gerado: 'text-blue-400',
  enviado: 'text-amber-400',
  aceito: 'text-emerald-400',
  processado: 'text-sky-400',
  faturado: 'text-green-400',
  glosado: 'text-red-400',
  pago: 'text-green-300',
}

const LOTE_STATUS_BAR_COLORS: Record<LoteStatus, string> = {
  rascunho: 'bg-slate-500',
  gerado: 'bg-blue-500',
  enviado: 'bg-amber-500',
  aceito: 'bg-emerald-500',
  processado: 'bg-sky-500',
  faturado: 'bg-green-600',
  glosado: 'bg-red-500',
  pago: 'bg-green-500',
}

function StatusBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="w-full bg-[var(--color-border)] rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
      />
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ icon: Icon, title, iconColor = 'text-[var(--color-primary)]' }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  iconColor?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
    </div>
  )
}

function BigKpi({ label, value, color = 'text-[var(--color-text)]' }: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
      <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  )
}

export default function RelatoriosPage() {
  const [mes, setMes] = useState(getCurrentMonth())
  const { data: report, isLoading, error } = useReportData(mes !== 'todos' ? mes : undefined)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatorios"
        description="Visao consolidada de producao e financeiro"
      />

      <div className="flex justify-end">
        <MonthFilter value={mes} onChange={setMes} />
      </div>

      {isLoading && <KpiSkeleton />}

      {error && (
        <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-xl p-4 text-sm text-[var(--color-danger)]">
          Erro ao carregar relatorios.
        </div>
      )}

      {report && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <BigKpi label="Total de Guias" value={report.total_guias} />
            </Card>
            <Card>
              <BigKpi label="Valor Total Guias" value={formatCurrency(report.valor_total_guias)} color="text-[var(--color-primary)]" />
            </Card>
            <Card>
              <BigKpi label="Total de Lotes" value={report.total_lotes} />
            </Card>
            <Card>
              <BigKpi label="Valor Total Lotes" value={formatCurrency(report.valor_total_lotes)} color="text-[var(--color-primary)]" />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Guias por Status */}
            <Card>
              <CardHeader icon={FileText} title="Guias por Status" />
              <div className="space-y-3">
                {GUIDE_STATUS_FLOW.map((status) => {
                  const data = report.guias_por_status[status]
                  if (!data) return null
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {GUIDE_STATUS_LABELS[status]}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {formatCurrency(data.valor)}
                          </span>
                          <span className={`font-mono font-bold text-sm min-w-[3ch] text-right ${GUIDE_STATUS_TEXT_COLORS[status]}`}>
                            {data.count}
                          </span>
                        </div>
                      </div>
                      <StatusBar
                        value={data.count}
                        max={report.total_guias}
                        color={GUIDE_STATUS_BAR_COLORS[status]}
                      />
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Lotes por Status */}
            <Card>
              <CardHeader icon={Package} title="Lotes por Status" iconColor="text-[var(--color-secondary)]" />
              <div className="space-y-3">
                {LOTE_STATUS_FLOW.map((status) => {
                  const data = report.lotes_por_status[status]
                  if (!data) return null
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {LOTE_STATUS_LABELS[status]}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {formatCurrency(data.valor)}
                          </span>
                          <span className={`font-mono font-bold text-sm min-w-[3ch] text-right ${LOTE_STATUS_TEXT_COLORS[status]}`}>
                            {data.count}
                          </span>
                        </div>
                      </div>
                      <StatusBar
                        value={data.count}
                        max={report.total_lotes}
                        color={LOTE_STATUS_BAR_COLORS[status]}
                      />
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* Financeiro + Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader icon={DollarSign} title="Financeiro" iconColor="text-[var(--color-success)]" />
              <div className="space-y-3">
                {[
                  { label: 'Total Cobrado', value: formatCurrency(report.total_cobrado), color: 'text-[var(--color-text)]' },
                  { label: 'Total Pago', value: formatCurrency(report.total_pago), color: 'text-[var(--color-success)]' },
                  { label: 'Total Glosado', value: formatCurrency(report.total_glosado), color: 'text-[var(--color-danger)]' },
                  { label: 'A Receber', value: formatCurrency(report.a_receber), color: 'text-[var(--color-warning)]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                    <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
                    <span className={`font-mono font-bold ${color}`}>{value}</span>
                  </div>
                ))}
                {report.total_cobrancas > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                      <span>Taxa de Pagamento</span>
                      <span className="font-mono">
                        {report.cobrancas_pagas}/{report.total_cobrancas} ({((report.cobrancas_pagas / report.total_cobrancas) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-[var(--color-border)] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-green-500 transition-all duration-500"
                        style={{ width: `${(report.cobrancas_pagas / report.total_cobrancas) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader icon={BarChart3} title="Pipeline" iconColor="text-[var(--color-warning)]" />
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">Guias sem Lote</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-[var(--color-warning)]">{report.guias_sem_lote}</span>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(report.valor_guias_sem_lote)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-[var(--color-danger)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">Guias Canceladas</span>
                  </div>
                  <span className="font-mono font-bold text-[var(--color-danger)]">{report.guias_canceladas}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[var(--color-primary)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">Total Cobrancas</span>
                  </div>
                  <span className="font-mono font-bold text-[var(--color-text)]">{report.total_cobrancas}</span>
                </div>

                {/* Resumo valor pipeline */}
                <div className="pt-2 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[var(--color-success)]" />
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Valor por Fase</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Completas', value: report.guias_por_status['COMPLETA']?.valor ?? 0, color: 'text-emerald-400' },
                      { label: 'Processadas', value: report.guias_por_status['PROCESSADA']?.valor ?? 0, color: 'text-sky-400' },
                      { label: 'Faturadas', value: report.guias_por_status['FATURADA']?.valor ?? 0, color: 'text-green-400' },
                      { label: 'Em Lotes', value: report.valor_total_lotes, color: 'text-[var(--color-primary)]' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[var(--color-bg)] rounded-lg p-2">
                        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                        <p className={`font-mono text-sm font-bold ${color}`}>{formatCurrency(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Resumo Faturamento */}
          <Card>
            <CardHeader icon={Wallet} title="Resumo do Faturamento" iconColor="text-[var(--color-success)]" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: 'Valor em Producao',
                  desc: 'Guias COMPLETA + PROCESSADA',
                  value: (report.guias_por_status['COMPLETA']?.valor ?? 0) + (report.guias_por_status['PROCESSADA']?.valor ?? 0),
                  color: 'text-sky-400',
                },
                {
                  label: 'Valor Faturado',
                  desc: 'Guias FATURADA',
                  value: report.guias_por_status['FATURADA']?.valor ?? 0,
                  color: 'text-green-400',
                },
                {
                  label: 'Valor Recebido',
                  desc: 'Cobrancas pagas',
                  value: report.total_pago,
                  color: 'text-[var(--color-success)]',
                },
                {
                  label: 'Perda (Glosas)',
                  desc: 'Cobrancas glosadas',
                  value: report.total_glosado,
                  color: 'text-[var(--color-danger)]',
                },
              ].map(({ label, desc, value, color }) => (
                <div key={label} className="bg-[var(--color-bg)] rounded-lg p-4 text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
                  <p className={`text-xl font-mono font-bold ${color}`}>{formatCurrency(value)}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
