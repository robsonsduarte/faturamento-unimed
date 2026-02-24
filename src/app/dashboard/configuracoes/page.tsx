import Link from 'next/link'
import { Building2, Plug, Users, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'

const items = [
  {
    href: '/dashboard/configuracoes/prestador',
    icon: Building2,
    title: 'Dados do Prestador',
    description: 'Nome, CNES, codigo ANS, padrao TISS',
  },
  {
    href: '/dashboard/configuracoes/integracoes',
    icon: Plug,
    title: 'Integracoes',
    description: 'SAW, ConsultorioPro, credenciais de API',
  },
  {
    href: '/dashboard/configuracoes/usuarios',
    icon: Users,
    title: 'Usuarios',
    description: 'Gerenciar acessos e permissoes',
  },
]

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configuracoes" description="Gerencie o sistema e integracoes" />

      <div className="space-y-2">
        {items.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 p-5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)]/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          </Link>
        ))}
      </div>
    </div>
  )
}
