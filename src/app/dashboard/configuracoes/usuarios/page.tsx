'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { TableSkeleton } from '@/components/shared/loading-skeleton'
import { formatDateTime, cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]',
  operador: 'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)]',
  visualizador: 'bg-slate-500/20 text-slate-400',
}

export default function UsuariosPage() {
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data as Profile[]
    },
  })

  const lista = profiles ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
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

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading && <div className="p-6"><TableSkeleton rows={4} /></div>}
        {!isLoading && lista.length === 0 && (
          <EmptyState icon={User} title="Nenhum usuario cadastrado" />
        )}
        {!isLoading && lista.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {['Nome', 'Email', 'Papel', 'Criado em'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {lista.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{p.full_name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{p.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', ROLE_COLORS[p.role] ?? '')}>
                      {p.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
