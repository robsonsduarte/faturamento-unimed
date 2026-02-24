'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut, User, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { cn } from '@/lib/utils'

interface HeaderProps {
  profile: Profile | null
}

export function Header({ profile }: HeaderProps) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Erro ao sair')
      return
    }
    router.push('/auth/login')
    router.refresh()
  }

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    operador: 'Operador',
    visualizador: 'Visualizador',
  }

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-[var(--color-surface)] border-b border-[var(--color-border)] shrink-0">
      <div />

      <div className="flex items-center gap-3">
        <button
          className={cn(
            'p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)] transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
          )}
          aria-label="Notificacoes"
        >
          <Bell className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 pl-3 border-l border-[var(--color-border)]">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
            <User className="w-4 h-4 text-[var(--color-primary)]" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-[var(--color-text)] leading-none">
              {profile?.full_name ?? 'Usuario'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {profile?.role ? roleLabel[profile.role] : ''}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className={cn(
              'ml-2 p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]'
            )}
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
