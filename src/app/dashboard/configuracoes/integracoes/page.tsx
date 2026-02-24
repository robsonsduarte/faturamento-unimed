import Link from 'next/link'
import { ArrowLeft, Globe, Server } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'

export default function IntegracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integracoes"
        action={
          <Link
            href="/dashboard/configuracoes"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-secondary)]/10 flex items-center justify-center">
              <Globe className="w-5 h-5 text-[var(--color-secondary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Portal SAW (Unimed)</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Coleta automatizada de guias</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">URL API</span>
              <span className="font-mono text-[var(--color-text)]">{process.env.NEXT_PUBLIC_SAW_API_URL ?? 'puppeteer-api:3001'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">Status</span>
              <span className="text-[var(--color-warning)]">Configurar via .env</span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">ConsultorioPro</h2>
              <p className="text-xs text-[var(--color-text-muted)]">Busca de procedimentos realizados</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">URL API</span>
              <span className="font-mono text-[var(--color-text)]">177.136.241.79</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--color-text-muted)]">Status</span>
              <span className="text-[var(--color-warning)]">Configurar via .env</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
        <p className="text-sm text-[var(--color-text-muted)]">
          As credenciais de integracao sao configuradas via variaveis de ambiente no arquivo{' '}
          <code className="font-mono text-xs bg-[var(--color-surface)] px-1 py-0.5 rounded">.env.local</code>.
          Edite o arquivo na raiz do projeto para configurar SAW_API_URL, CPRO_API_URL e CPRO_API_KEY.
        </p>
      </div>
    </div>
  )
}
