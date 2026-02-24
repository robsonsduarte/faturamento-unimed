'use client'

import { BarChart3, TrendingUp, DollarSign, FileText } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { useDashboardKPIs } from '@/hooks/use-dashboard'
import { formatCurrency } from '@/lib/utils'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'

export default function RelatoriosPage() {
  const { data: kpis, isLoading } = useDashboardKPIs()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatorios"
        description="Visao consolidada de producao e financeiro"
      />

      {isLoading && <KpiSkeleton />}

      {kpis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[var(--color-primary)]" />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Producao de Guias</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Total de Guias', value: kpis.total_guias, color: 'text-[var(--color-text)]' },
                { label: 'Pendentes', value: kpis.guias_pendentes, color: 'text-[var(--color-warning)]' },
                { label: 'Processadas', value: kpis.guias_processadas, color: 'text-[var(--color-primary)]' },
                { label: 'Faturadas', value: kpis.guias_faturadas, color: 'text-[var(--color-success)]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
                  <span className={`font-mono font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-[var(--color-success)]" />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Financeiro</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Valor Faturado', value: formatCurrency(kpis.valor_total_faturado), color: 'text-[var(--color-success)]' },
                { label: 'Valor Pago', value: formatCurrency(kpis.valor_total_pago), color: 'text-[var(--color-primary)]' },
                { label: 'Valor Glosado', value: formatCurrency(kpis.valor_total_glosado), color: 'text-[var(--color-danger)]' },
                { label: 'Lotes Abertos', value: kpis.lotes_abertos, color: 'text-[var(--color-warning)]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
                  <span className={`font-mono font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-[var(--color-secondary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Graficos de Producao</h2>
        </div>
        <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-muted)]">
          <div className="text-center">
            <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Graficos disponiveis na Fase 2</p>
          </div>
        </div>
      </div>
    </div>
  )
}
