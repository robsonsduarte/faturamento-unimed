'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LogOut, User, Settings, Eye, EyeOff, Save, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { NotificationsBell } from './notifications-bell'

interface HeaderProps {
  profile: Profile | null
}

const INPUT_CLASS = 'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'

export function Header({ profile }: HeaderProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    <>
      <header className="h-16 flex items-center justify-between px-6 bg-[var(--color-surface)] border-b border-[var(--color-border)] shrink-0">
        <div />

        <div className="flex items-center gap-3">
          {profile?.id && <NotificationsBell userId={profile.id} />}

          <div className="relative flex items-center gap-2.5 pl-3 border-l border-[var(--color-border)]" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
                <User className="w-4 h-4 text-[var(--color-primary)]" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-[var(--color-text)] leading-none">
                  {profile?.full_name ?? 'Usuario'}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {profile?.role ? roleLabel[profile.role] : ''}
                </p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-xl z-50 py-1"
                style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
              >
                <button
                  onClick={() => { setShowMenu(false); setShowProfile(true) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--color-surface)] transition-colors"
                  style={{ color: 'var(--color-text)' }}
                >
                  <Settings className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                  Meu Perfil
                </button>
                <div className="border-t my-1" style={{ borderColor: 'var(--color-border)' }} />
                <button
                  onClick={() => { setShowMenu(false); handleSignOut() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-[var(--color-surface)] transition-colors"
                  style={{ color: 'var(--color-danger)' }}
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Meu Perfil */}
      {showProfile && profile && (
        <MyProfileModal
          profile={profile}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  )
}

// ─── Modal Meu Perfil ─────────────────────────────────────────
function MyProfileModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sawUsuario, setSawUsuario] = useState('')
  const [sawSenha, setSawSenha] = useState('')
  const [showSawSenha, setShowSawSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.sawCredentials) {
          setSawUsuario(data.sawCredentials.usuario ?? '')
        }
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
  }, [profile.id])

  async function handleSave() {
    setLoading(true)
    try {
      const body: Record<string, string> = {}
      if (fullName !== profile.full_name) body.full_name = fullName
      if (password) body.password = password
      if (sawUsuario) body.saw_usuario = sawUsuario
      if (sawSenha) body.saw_senha = sawSenha

      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Perfil atualizado com sucesso')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-md rounded-xl border shadow-2xl"
        style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center">
              <User className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Meu Perfil</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{profile.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
          </div>
        ) : (
          <div className="px-6 py-5 space-y-5">
            {/* Nome */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nome completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT_CLASS} />
            </div>

            {/* Senha do sistema */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Senha do sistema (deixe vazio para manter)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nova senha (min. 8 caracteres)"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

            {/* SAW */}
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Credenciais SAW</p>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Usuario SAW</label>
              <input
                value={sawUsuario}
                onChange={(e) => setSawUsuario(e.target.value)}
                placeholder="Ex: cnu.robson.duarte"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Senha SAW (deixe vazio para manter)</label>
              <div className="relative">
                <input
                  type={showSawSenha ? 'text' : 'password'}
                  value={sawSenha}
                  onChange={(e) => setSawSenha(e.target.value)}
                  placeholder="Senha do SAW"
                  className={INPUT_CLASS}
                />
                <button
                  type="button"
                  onClick={() => setShowSawSenha(!showSawSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {showSawSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--color-primary)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
