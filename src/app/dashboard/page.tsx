'use client'

import {
  FileText,
  Package,
  DollarSign,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  Clock,
  UserCheck,
  Key,
} from 'lucide-react'
import { useDashboardKPIs } from '@/hooks/use-dashboard'
import { KpiCard } from '@/components/shared/kpi-card'
import { KpiSkeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency } from '@/lib/utils'

export default function DashboardPage() {
  const { data: kpis, isLoading, error } = useDashboardKPIs()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visao geral do faturamento DEDICARE"
      />

      {isLoading && <KpiSkeleton />}

      {error && (
        <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-xl p-4 text-sm text-[var(--color-danger)]">
          Erro ao carregar KPIs. Verifique a conexao com o banco de dados.
        </div>
      )}

      {kpis && (
        <>
          {/* Linha 1 — Pipeline de Guias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total de Guias"
              value={kpis.total_guias}
              icon={FileText}
              variant="default"
            />
            <KpiCard
              title="Guias Pendentes"
              value={kpis.guias_pendentes}
              icon={AlertCircle}
              variant="warning"
            />
            <KpiCard
              title="Guias CPro"
              value={kpis.guias_cpro}
              icon={UserCheck}
              variant="warning"
            />
            <KpiCard
              title="Guias Token"
              value={kpis.guias_token}
              icon={Key}
              variant="warning"
            />
          </div>

          {/* Linha 2 — Guias Avancadas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Guias Completas"
              value={kpis.guias_completas}
              icon={Clock}
              variant="primary"
            />
            <KpiCard
              title="Guias Processadas"
              value={kpis.guias_processadas}
              icon={TrendingUp}
              variant="primary"
            />
            <KpiCard
              title="Guias Faturadas"
              value={kpis.guias_faturadas}
              icon={CheckCircle}
              variant="success"
            />
            <KpiCard
              title="Lotes Abertos"
              value={kpis.lotes_abertos}
              icon={Package}
              variant="warning"
            />
          </div>

          {/* Linha 3 — Valores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Valor Total"
              value={formatCurrency(kpis.valor_total_guias)}
              icon={DollarSign}
              variant="default"
            />
            <KpiCard
              title="Valor Completas"
              value={formatCurrency(kpis.valor_completas)}
              icon={DollarSign}
              variant="primary"
            />
            <KpiCard
              title="Valor Processado"
              value={formatCurrency(kpis.valor_processado)}
              icon={DollarSign}
              variant="primary"
            />
            <KpiCard
              title="Valor Faturado"
              value={formatCurrency(kpis.valor_total_faturado)}
              icon={DollarSign}
              variant="success"
            />
          </div>

          {/* Linha 4 — Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              title="Valor Pago"
              value={formatCurrency(kpis.valor_total_pago)}
              icon={DollarSign}
              variant="primary"
            />
            <KpiCard
              title="Valor Glosado"
              value={formatCurrency(kpis.valor_total_glosado)}
              icon={DollarSign}
              variant="danger"
            />
            <KpiCard
              title="Valor a Receber"
              value={formatCurrency(
                (kpis.valor_total_faturado ?? 0) -
                  (kpis.valor_total_pago ?? 0) -
                  (kpis.valor_total_glosado ?? 0)
              )}
              icon={DollarSign}
              variant="warning"
            />
          </div>
        </>
      )}
    </div>
  )
}
