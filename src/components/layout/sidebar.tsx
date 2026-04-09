'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  Package,
  Code2,
  CreditCard,
  Fingerprint,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  HelpCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types'

type UserRole = Profile['role']

const allNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true, roles: ['admin', 'operador'] as UserRole[] },
  { href: '/dashboard/guias', icon: FileText, label: 'Guias', roles: ['admin', 'operador', 'visualizador'] as UserRole[] },
  { href: '/dashboard/guias/emitir', icon: FilePlus, label: 'Emitir Guia', roles: ['admin', 'operador', 'visualizador'] as UserRole[] },
  { href: '/dashboard/lotes', icon: Package, label: 'Lotes', roles: ['admin', 'operador'] as UserRole[] },
  { href: '/dashboard/xml', icon: Code2, label: 'XML TISS', roles: ['admin', 'operador'] as UserRole[] },
  { href: '/dashboard/cobrancas', icon: CreditCard, label: 'Cobrancas', roles: ['admin', 'operador'] as UserRole[] },
  { href: '/dashboard/tokens', icon: Fingerprint, label: 'Tokens', roles: ['admin', 'operador'] as UserRole[] },
  { href: '/dashboard/relatorios', icon: BarChart3, label: 'Relatorios', roles: ['admin', 'operador'] as UserRole[] },
  { href: '/dashboard/configuracoes', icon: Settings, label: 'Configuracoes', roles: ['admin'] as UserRole[] },
  { href: '/dashboard/ajuda', icon: HelpCircle, label: 'Ajuda', roles: ['admin', 'operador', 'visualizador'] as UserRole[] },
]

export function Sidebar({ role = 'visualizador' }: { role?: UserRole }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-hidden shrink-0"
    >
      <div className="flex items-center h-16 px-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="font-semibold text-sm text-[var(--color-text)] truncate"
              >
                Faturamento
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {allNavItems.filter((item) => item.roles.includes(role)).map(({ href, icon: Icon, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href as never}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                active
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)]'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="truncate"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-3 border-t border-[var(--color-border)]"
          >
            <p className="text-xs text-[var(--color-text-muted)]">DEDICARE</p>
            <p className="text-xs text-[var(--color-text-muted)]">TISS 4.02.00</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
