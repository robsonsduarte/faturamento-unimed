'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Save,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'
import type { Integracao, SawConfig, CproConfig } from '@/lib/types'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
      {children}
    </label>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  readOnly?: boolean
}

function Field({ readOnly, className, ...props }: InputProps) {
  return (
    <input
      readOnly={readOnly}
      {...props}
      className={cn(
        'w-full px-3 py-2 rounded-lg text-sm bg-[var(--color-surface)] border border-[var(--color-border)]',
        'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        readOnly && 'opacity-60 cursor-not-allowed',
        className
      )}
    />
  )
}

function PasswordField({
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  readOnly?: boolean
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Field
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className="pr-10"
      />
      {!readOnly && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        ativo
          ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
          : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', ativo ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]')} />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function IntegracoesPage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const [sawRow, setSawRow] = useState<Integracao | null>(null)
  const [cproRow, setCproRow] = useState<Integracao | null>(null)

  const [sawForm, setSawForm] = useState<SawConfig>({
    api_url: '',
    login_url: '',
    usuario: '',
    senha: '',
    cookie_key: '',
  })

  const [cproForm, setCproForm] = useState<CproConfig>({
    api_url: '',
    api_key: '',
    company: '1',
  })

  const [loadingPage, setLoadingPage] = useState(true)
  const [savingSaw, setSavingSaw] = useState(false)
  const [savingCpro, setSavingCpro] = useState(false)
  const [testingSaw, setTestingSaw] = useState(false)
  const [sawTestResult, setSawTestResult] = useState<'ok' | 'error' | null>(null)

  // Load profile + integracoes
  const load = useCallback(async () => {
    setLoadingPage(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: prof }, { data: rows }] = await Promise.all([
        supabase.from('profiles').select('role').eq('id', user.id).single(),
        supabase.from('integracoes').select('*').in('slug', ['saw', 'cpro']),
      ])

      if (prof) setProfile(prof)

      if (rows) {
        const saw = rows.find((r: Integracao) => r.slug === 'saw') ?? null
        const cpro = rows.find((r: Integracao) => r.slug === 'cpro') ?? null
        setSawRow(saw)
        setCproRow(cpro)
        if (saw) setSawForm(saw.config as SawConfig)
        if (cpro) setCproForm(cpro.config as CproConfig)
      }
    } finally {
      setLoadingPage(false)
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const isAdmin = profile?.role === 'admin'

  // Save SAW
  async function handleSaveSaw() {
    if (!isAdmin) return
    setSavingSaw(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = { config: sawForm, updated_by: user?.id, updated_at: new Date().toISOString() }

      const { error } = sawRow
        ? await supabase.from('integracoes').update(payload).eq('slug', 'saw')
        : await supabase.from('integracoes').insert({ slug: 'saw', nome: 'Portal SAW (Unimed)', ...payload })

      if (error) throw new Error(error.message)
      toast.success('Configuracoes SAW salvas com sucesso')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar SAW')
    } finally {
      setSavingSaw(false)
    }
  }

  // Save CPro
  async function handleSaveCpro() {
    if (!isAdmin) return
    setSavingCpro(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = { config: cproForm, updated_by: user?.id, updated_at: new Date().toISOString() }

      const { error } = cproRow
        ? await supabase.from('integracoes').update(payload).eq('slug', 'cpro')
        : await supabase.from('integracoes').insert({ slug: 'cpro', nome: 'ConsultorioPro', ...payload })

      if (error) throw new Error(error.message)
      toast.success('Configuracoes CPro salvas com sucesso')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar CPro')
    } finally {
      setSavingCpro(false)
    }
  }

  // Test SAW connection
  async function handleTestSaw() {
    setTestingSaw(true)
    setSawTestResult(null)
    try {
      const res = await fetch('/api/integracoes/saw/status')
      const data = await res.json() as { ativa: boolean; error?: string }
      if (res.ok && data.ativa) {
        setSawTestResult('ok')
        toast.success('Conexao SAW ativa')
      } else if (data.error) {
        throw new Error(data.error)
      } else {
        setSawTestResult('error')
        toast.info('SAW acessivel, mas sem sessao ativa. Faca login primeiro.')
      }
    } catch (err) {
      setSawTestResult('error')
      toast.error(err instanceof Error ? err.message : 'Erro ao testar SAW')
    } finally {
      setTestingSaw(false)
    }
  }

  if (loadingPage) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-muted)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integracoes"
        description="Gerencie as credenciais dos sistemas externos"
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

      {!isAdmin && (
        <div className="rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-4 py-3 text-sm text-[var(--color-warning)]">
          Voce esta no modo somente leitura. Apenas administradores podem editar as integracoes.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* SAW card */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-secondary)]/10 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-[var(--color-secondary)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">Portal SAW (Unimed)</h2>
                <p className="text-xs text-[var(--color-text-muted)]">Coleta automatizada de guias via Puppeteer</p>
              </div>
            </div>
            {sawRow && <StatusBadge ativo={sawRow.ativo} />}
          </div>

          <div className="space-y-3">
            <div>
              <FieldLabel>URL da API Puppeteer</FieldLabel>
              <Field
                type="text"
                value={sawForm.api_url}
                onChange={(e) => setSawForm({ ...sawForm, api_url: e.target.value })}
                readOnly={!isAdmin}
                placeholder="http://puppeteer-api:3001"
              />
            </div>
            <div>
              <FieldLabel>URL de Login SAW</FieldLabel>
              <Field
                type="text"
                value={sawForm.login_url}
                onChange={(e) => setSawForm({ ...sawForm, login_url: e.target.value })}
                readOnly={!isAdmin}
                placeholder="https://saw.trixti.com.br/saw/Logar.do"
              />
            </div>
            <div>
              <FieldLabel>Usuario</FieldLabel>
              <Field
                type="text"
                value={sawForm.usuario}
                onChange={(e) => setSawForm({ ...sawForm, usuario: e.target.value })}
                readOnly={!isAdmin}
                placeholder="cnu.usuario"
              />
            </div>
            <div>
              <FieldLabel>Senha</FieldLabel>
              <PasswordField
                value={sawForm.senha}
                onChange={(v) => setSawForm({ ...sawForm, senha: v })}
                readOnly={!isAdmin}
                placeholder="••••••••"
              />
            </div>
            <div>
              <FieldLabel>Cookie Key</FieldLabel>
              <Field
                type="text"
                value={sawForm.cookie_key}
                onChange={(e) => setSawForm({ ...sawForm, cookie_key: e.target.value })}
                readOnly={!isAdmin}
                placeholder="saw_session_cookies"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleTestSaw}
              disabled={testingSaw}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {testingSaw ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : sawTestResult === 'ok' ? (
                <Wifi className="w-3.5 h-3.5 text-[var(--color-success)]" />
              ) : sawTestResult === 'error' ? (
                <WifiOff className="w-3.5 h-3.5 text-[var(--color-danger)]" />
              ) : (
                <Wifi className="w-3.5 h-3.5" />
              )}
              Testar Conexao
            </button>

            {isAdmin && (
              <button
                onClick={handleSaveSaw}
                disabled={savingSaw}
                className={cn(
                  'ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white',
                  'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {savingSaw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            )}
          </div>
        </div>

        {/* CPro card */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
                <Server className="w-5 h-5 text-[var(--color-primary)]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">ConsultorioPro</h2>
                <p className="text-xs text-[var(--color-text-muted)]">Busca de procedimentos realizados</p>
              </div>
            </div>
            {cproRow && <StatusBadge ativo={cproRow.ativo} />}
          </div>

          <div className="space-y-3">
            <div>
              <FieldLabel>URL da API</FieldLabel>
              <Field
                type="text"
                value={cproForm.api_url}
                onChange={(e) => setCproForm({ ...cproForm, api_url: e.target.value })}
                readOnly={!isAdmin}
                placeholder="https://177.136.241.79"
              />
            </div>
            <div>
              <FieldLabel>API Key</FieldLabel>
              <PasswordField
                value={cproForm.api_key}
                onChange={(v) => setCproForm({ ...cproForm, api_key: v })}
                readOnly={!isAdmin}
                placeholder="••••••••"
              />
            </div>
            <div>
              <FieldLabel>Empresa (company)</FieldLabel>
              <Field
                type="text"
                value={cproForm.company}
                onChange={(e) => setCproForm({ ...cproForm, company: e.target.value })}
                readOnly={!isAdmin}
                placeholder="1"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-1">
              <button
                onClick={handleSaveCpro}
                disabled={savingCpro}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white',
                  'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {savingCpro ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info footer */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl px-5 py-4">
        <p className="text-xs text-[var(--color-text-muted)]">
          As credenciais sao armazenadas na tabela{' '}
          <code className="font-mono bg-[var(--color-surface)] px-1 py-0.5 rounded">integracoes</code>{' '}
          do banco de dados com Row Level Security. Apenas administradores podem editar.
          As senhas sao transmitidas via HTTPS e nunca expostas no frontend em texto plano sem acao do usuario.
        </p>
      </div>
    </div>
  )
}
