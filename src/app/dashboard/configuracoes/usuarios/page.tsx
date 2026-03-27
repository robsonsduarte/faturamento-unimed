'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, User, UserPlus, X, Pencil, Eye, EyeOff, Loader2, Save } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  visualizador: 'Visualizador',
}

const INPUT_CLASS = 'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'

export default function UsuariosPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setCurrentUserRole(p?.role ?? null)
      }
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data as Profile[]
    },
  })

  const isAdmin = currentUserRole === 'admin'
  const lista = profiles ?? []

  const canEdit = (p: Profile) => {
    if (isAdmin && p.id !== currentUserId) return true // admin edita outros
    if (p.id === currentUserId) return true // todos editam a si mesmos
    return false
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowForm(true)}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
                )}
              >
                <UserPlus className="w-4 h-4" />
                Novo usuario
              </button>
            )}
            <Link
              href="/dashboard/configuracoes"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
          </div>
        }
      />

      {showForm && isAdmin && (
        <InviteForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['profiles'] }) }}
        />
      )}

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading && <div className="p-6"><TableSkeleton rows={4} /></div>}
        {!isLoading && lista.length === 0 && (
          <EmptyState icon={User} title="Nenhum usuario cadastrado" />
        )}
        {!isLoading && lista.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {['Nome', 'Email', 'Papel', 'Criado em', ''].map((h) => (
                  <th key={h || 'actions'} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
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
                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', ROLE_COLORS[p.role] ?? '')}>
                      {ROLE_LABELS[p.role] ?? p.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDateTime(p.created_at)}</td>
                  <td className="px-4 py-3">
                    {canEdit(p) && (
                      <button
                        onClick={() => setEditingUser(p)}
                        className="inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-1 transition-colors"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Edicao */}
      {editingUser && (
        <EditUserModal
          profile={editingUser}
          isAdmin={isAdmin}
          isSelf={editingUser.id === currentUserId}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null)
            queryClient.invalidateQueries({ queryKey: ['profiles'] })
          }}
        />
      )}
    </div>
  )
}

// ─── Modal de Edicao ──────────────────────────────────────────
function EditUserModal({
  profile,
  isAdmin,
  isSelf,
  onClose,
  onSuccess,
}: {
  profile: Profile
  isAdmin: boolean
  isSelf: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [role, setRole] = useState(profile.role)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [sawUsuario, setSawUsuario] = useState('')
  const [sawSenha, setSawSenha] = useState('')
  const [showSawSenha, setShowSawSenha] = useState(false)
  const sawLoginUrl = 'https://saw.trixti.com.br/saw/Logar.do?method=abrirSAW'
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // Carregar dados do usuario (incluindo credenciais SAW)
  useEffect(() => {
    fetch(`/api/users/${profile.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.sawCredentials) {
          setSawUsuario(data.sawCredentials.usuario ?? '')
          // login_url vem da config global de integracoes
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
      if (role !== profile.role && isAdmin && !isSelf) body.role = role
      if (password) body.password = password
      if (sawUsuario) body.saw_usuario = sawUsuario
      if (sawSenha) body.saw_senha = sawSenha
      if (sawLoginUrl) body.saw_login_url = sawLoginUrl

      const res = await fetch(`/api/users/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('Usuario atualizado com sucesso')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-lg rounded-xl border shadow-2xl"
        style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Editar Usuario</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{profile.email}</p>
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
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Dados do Perfil */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Perfil</p>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nome completo</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT_CLASS} />
              </div>

              {isAdmin && !isSelf && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Papel</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as Profile['role'])} className={INPUT_CLASS}>
                    <option value="visualizador">Visualizador</option>
                    <option value="operador">Operador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Nova senha (deixe vazio para manter)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimo 8 caracteres"
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
            </div>

            {/* Credenciais SAW */}
            <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
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

// ─── Formulario de Convite ────────────────────────────────────
function InviteForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('visualizador')

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar usuario')
      return data
    },
    onSuccess: (data) => {
      toast.success(`Usuario ${data.user.full_name} criado com sucesso`)
      onSuccess()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Novo usuario</h3>
        <button onClick={onClose} className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); invite.mutate() }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Nome completo</label>
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Maria Silva" className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Email</label>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@dedicare.com.br" className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Senha inicial</label>
          <input required type="text" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimo 8 caracteres" className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Papel</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className={INPUT_CLASS}>
            <option value="visualizador">Visualizador</option>
            <option value="operador">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
            Cancelar
          </button>
          <button type="submit" disabled={invite.isPending} className={cn('px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--color-primary)] disabled:opacity-50')}>
            {invite.isPending ? 'Criando...' : 'Criar usuario'}
          </button>
        </div>
      </form>
    </div>
  )
}
