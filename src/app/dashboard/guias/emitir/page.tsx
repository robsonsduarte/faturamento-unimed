'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, FilePlus, Send, Loader2, CheckCircle, X, Download, TerminalSquare } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'
import type { ImportLog } from '@/lib/types'

const CONSELHOS = [
  { codigo: '08', label: 'CRP' },
  { codigo: '06', label: 'CRM' },
  { codigo: '07', label: 'CREFONO' },
]

const UFS = [
  { codigo: '29', label: 'BA' },
  { codigo: '35', label: 'SP' },
  { codigo: '33', label: 'RJ' },
]

const PROCEDIMENTOS = [
  { codigo: '50000012', descricao: 'Sessão de Psicomotricidade' },
  { codigo: '50000462', descricao: 'Consulta Psicologia' },
  { codigo: '50000470', descricao: 'Sessão de Psicoterapia Individual por Psicólogo' },
  { codigo: '50000560', descricao: 'Consulta Nutricionista' },
  { codigo: '50000586', descricao: 'Consulta Fonoaudiologia' },
  { codigo: '50000616', descricao: 'Sessão Individual Ambulatorial de Fonoaudiologia' },
  { codigo: '50000675', descricao: 'Avaliação do Processamento Auditivo Central' },
  { codigo: '50001213', descricao: 'Musicoterapia' },
]

interface SuccessResult {
  guideNumber: string
  paciente: string
}

function LogLine({ log }: { log: ImportLog }) {
  const colorMap: Record<ImportLog['type'], string> = {
    info: 'text-[#a0a0a0]',
    processing: 'text-[#f0c040]',
    success: 'text-[#4ade80]',
    error: 'text-[#f87171]',
  }

  const prefixMap: Record<ImportLog['type'], string> = {
    info: '  ',
    processing: '~ ',
    success: '+ ',
    error: '- ',
  }

  return (
    <div className="flex gap-2 leading-5">
      <span className="shrink-0 text-[#4ade80] select-none">[{log.timestamp}]</span>
      <span className={cn('shrink-0 select-none', colorMap[log.type])}>{prefixMap[log.type]}</span>
      <span className={colorMap[log.type]}>{log.message}</span>
    </div>
  )
}

export default function EmitirGuiaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [pacienteNome, setPacienteNome] = useState('')
  const [carteiraPrefix] = useState('0865')
  const [carteiraSuffix, setCarteiraSuffix] = useState('')
  const [profNome, setProfNome] = useState('')
  const [profConselho, setProfConselho] = useState('08') // default CRP
  const [profNumero, setProfNumero] = useState('')
  const [profUf, setProfUf] = useState('29') // default BA
  const [profCbo, setProfCbo] = useState('')
  const [procedimentoCodigo, setProcedimentoCodigo] = useState('')
  const [quantidade, setQuantidade] = useState('4')
  const [indicacaoClinica, setIndicacaoClinica] = useState('')

  // Pre-fill from query params (when coming from guide detail page)
  useEffect(() => {
    const paciente = searchParams.get('paciente')
    const carteira = searchParams.get('carteira')
    const prof = searchParams.get('profissional')
    const conselho = searchParams.get('prof_conselho')
    const numero = searchParams.get('prof_numero')
    const uf = searchParams.get('prof_uf')
    const cbo = searchParams.get('prof_cbo')
    const proc = searchParams.get('procedimento')
    const qtd = searchParams.get('quantidade')
    const cid = searchParams.get('cid')

    if (paciente) setPacienteNome(paciente)
    if (carteira) {
      // Remove prefix 0865 or 865 if present
      const suffix = carteira.replace(/^0?865/, '')
      setCarteiraSuffix(suffix)
    }
    if (prof) setProfNome(prof)
    if (conselho) setProfConselho(conselho)
    if (numero) setProfNumero(numero)
    if (uf) setProfUf(uf)
    if (cbo) setProfCbo(cbo)
    if (proc) {
      const match = PROCEDIMENTOS.find(p => p.codigo === proc)
      if (match) setProcedimentoCodigo(match.codigo)
      else if (proc) setProcedimentoCodigo(proc) // Set even if not in list
    }
    if (qtd) setQuantidade(qtd)
    if (cid) setIndicacaoClinica(cid)
  }, [searchParams])

  // Emission state
  const [loadingEmitir, setLoadingEmitir] = useState(false)
  const [loadingImportar, setLoadingImportar] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [successResult, setSuccessResult] = useState<SuccessResult | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loading = loadingEmitir || loadingImportar

  const appendLog = useCallback((log: ImportLog) => {
    setLogs((prev) => [...prev, log])
    // Scroll happens via useEffect on parent, but we trigger it here too
    setTimeout(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }, [])

  function nowTimestamp() {
    return new Date().toLocaleTimeString('pt-BR', { hour12: false })
  }

  function validateForm(): string | null {
    if (!carteiraSuffix.trim()) return 'Informe o numero da carteira'
    if (carteiraSuffix.trim().length > 13) return 'Carteira deve ter no maximo 13 digitos'
    if (!profNome.trim()) return 'Informe o nome do profissional'
    if (!profNumero.trim()) return 'Informe o numero do conselho do profissional'
    if (!procedimentoCodigo) return 'Selecione um procedimento'
    const qtd = parseInt(quantidade, 10)
    if (isNaN(qtd) || qtd < 1) return 'Quantidade deve ser maior que zero'
    return null
  }

  async function handleEmitir() {
    if (loading) return

    const error = validateForm()
    if (error) {
      toast.error(error)
      return
    }

    const carteira = carteiraSuffix.trim()

    setLoadingEmitir(true)
    setLogs([])
    setSuccessResult(null)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const response = await fetch('/api/guias/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carteira,
          profissional: {
            nome: profNome,
            conselho: profConselho,
            numeroConselho: profNumero,
            uf: profUf,
            cbo: profCbo,
          },
          procedimento_codigo: procedimentoCodigo,
          quantidade: parseInt(quantidade, 10),
          indicacao_clinica: indicacaoClinica.trim() || undefined,
        }),
        signal: abort.signal,
      })

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: 'Erro ao iniciar emissao' })) as { error: string }
        throw new Error(err.error)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              type: ImportLog['type'] | 'result'
              message: string
              timestamp: string
              guide_number?: string
              guideNumber?: string
              paciente?: string
            }

            if (parsed.type === 'result') {
              // Success result — show modal
              setSuccessResult({
                guideNumber: parsed.guideNumber ?? parsed.guide_number ?? '',
                paciente: parsed.paciente ?? '',
              })
              toast.success('Guia emitida com sucesso!')
            } else {
              appendLog({
                type: parsed.type as ImportLog['type'],
                message: parsed.message,
                timestamp: parsed.timestamp,
                guide_number: parsed.guide_number,
              })
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        appendLog({ type: 'error', message: 'Emissao cancelada pelo usuario.', timestamp: nowTimestamp() })
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao emitir guia'
        appendLog({ type: 'error', message: `Erro fatal: ${msg}`, timestamp: nowTimestamp() })
        toast.error(msg)
      }
    } finally {
      setLoadingEmitir(false)
      abortRef.current = null
    }
  }

  async function handleImportarGuia(guideNumber: string) {
    if (loadingImportar) return

    setLoadingImportar(true)
    appendLog({ type: 'info', message: `Iniciando importacao da guia ${guideNumber}...`, timestamp: nowTimestamp() })

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const response = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_numbers: [guideNumber] }),
        signal: abort.signal,
      })

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: 'Erro ao iniciar importacao' })) as { error: string }
        throw new Error(err.error)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let imported = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6)) as {
              type: ImportLog['type']
              message: string
              timestamp: string
              guide_number?: string
            }

            appendLog({
              type: parsed.type,
              message: parsed.message,
              timestamp: parsed.timestamp,
              guide_number: parsed.guide_number,
            })

            if (parsed.type === 'success') imported = true
          } catch {
            // Malformed SSE line — skip
          }
        }
      }

      if (imported) {
        toast.success('Guia importada com sucesso!')
        router.push('/dashboard/guias')
      } else {
        toast.info('Importacao concluida')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        appendLog({ type: 'error', message: 'Importacao cancelada pelo usuario.', timestamp: nowTimestamp() })
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao importar'
        appendLog({ type: 'error', message: `Erro fatal: ${msg}`, timestamp: nowTimestamp() })
        toast.error(msg)
      }
    } finally {
      setLoadingImportar(false)
      abortRef.current = null
    }
  }

  function handleCancelar() {
    abortRef.current?.abort()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emitir Guia"
        description="Solicita nova guia no portal SAW com log em tempo real"
        action={
          <Link
            href="/dashboard/guias"
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
        {/* Left panel: form */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Dados da guia</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Preencha os dados para emitir a guia no portal SAW.
            </p>
          </div>

          {/* Paciente (readonly) */}
          {pacienteNome && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Paciente
              </label>
              <div
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text)] opacity-75"
              >
                {pacienteNome}
              </div>
            </div>
          )}

          {/* Carteira */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Carteira
            </label>
            <div className="flex items-center gap-0">
              <span
                className={cn(
                  'inline-flex items-center px-3 py-2.5 rounded-l-lg',
                  'bg-[var(--color-surface)] border border-r-0 border-[var(--color-border)]',
                  'text-sm font-mono text-[var(--color-text-muted)] select-none'
                )}
              >
                {carteiraPrefix}
              </span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={13}
                value={carteiraSuffix}
                onChange={(e) => setCarteiraSuffix(e.target.value.replace(/\D/g, ''))}
                placeholder="0000000000000"
                disabled={loading}
                className={cn(
                  'flex-1 px-3.5 py-2.5 rounded-r-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50'
                )}
              />
            </div>
          </div>

          {/* Profissional */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Profissional
            </label>
            <input
              type="text"
              value={profNome}
              onChange={(e) => setProfNome(e.target.value)}
              placeholder="Nome completo do profissional"
              disabled={loading}
              className={cn(
                'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'disabled:opacity-50'
              )}
            />
          </div>

          {/* Conselho / Numero / UF / CBO */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Conselho
              </label>
              <select
                value={profConselho}
                onChange={(e) => setProfConselho(e.target.value)}
                disabled={loading}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50'
                )}
              >
                {CONSELHOS.map((c) => (
                  <option key={c.codigo} value={c.codigo}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Numero
              </label>
              <input
                type="text"
                value={profNumero}
                onChange={(e) => setProfNumero(e.target.value)}
                placeholder="00000"
                disabled={loading}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50'
                )}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                UF
              </label>
              <select
                value={profUf}
                onChange={(e) => setProfUf(e.target.value)}
                disabled={loading}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50'
                )}
              >
                {UFS.map((u) => (
                  <option key={u.codigo} value={u.codigo}>{u.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                CBO
              </label>
              <input
                type="text"
                value={profCbo}
                onChange={(e) => setProfCbo(e.target.value)}
                placeholder="ex: psicólogo"
                disabled={loading}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50'
                )}
              />
            </div>
          </div>

          {/* Procedimento + Quantidade */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Procedimento
              </label>
              <select
                value={procedimentoCodigo}
                onChange={(e) => setProcedimentoCodigo(e.target.value)}
                disabled={loading}
                className={cn(
                  'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50',
                  !procedimentoCodigo && 'text-[var(--color-text-muted)]'
                )}
              >
                <option value="" disabled>Selecione...</option>
                {PROCEDIMENTOS.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} — {p.descricao}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                disabled={loading}
                className={cn(
                  'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50'
                )}
              />
            </div>
          </div>

          {/* Indicacao Clinica */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              Indicacao Clinica <span className="normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={indicacaoClinica}
              onChange={(e) => setIndicacaoClinica(e.target.value)}
              placeholder="Descreva a indicacao clinica..."
              disabled={loading}
              className={cn(
                'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'disabled:opacity-50'
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => void handleEmitir()}
              disabled={loading}
              className={cn(
                'flex-1 py-2.5 rounded-lg font-medium text-sm text-white',
                'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {loadingEmitir ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Emitindo...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Emitir Guia
                </>
              )}
            </button>

            {loading && (
              <button
                onClick={handleCancelar}
                className={cn(
                  'px-4 py-2.5 rounded-lg font-medium text-sm',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]'
                )}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Right panel: real-time log console */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <TerminalSquare className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Log de emissao</span>
            {loading && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[#f0c040]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f0c040] animate-pulse" />
                Ao vivo
              </span>
            )}
            {!loading && successResult && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[#4ade80]">
                <CheckCircle className="w-3.5 h-3.5" />
                Concluido
              </span>
            )}
          </div>

          <div
            className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5"
            style={{
              background: '#0a0a0a',
              minHeight: '400px',
              maxHeight: '500px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#333 #0a0a0a',
            }}
          >
            {logs.length === 0 && !loading && (
              <p className="text-[#444] select-none">
                Aguardando emissao da guia...
              </p>
            )}

            {loading && logs.length === 0 && (
              <p className="text-[#f0c040]">Conectando...</p>
            )}

            {logs.map((log, i) => (
              <LogLine key={i} log={log} />
            ))}

            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {successResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={cn(
              'w-full max-w-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-2xl',
              'space-y-5'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text)]">Guia emitida com sucesso!</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Pronta para importacao</p>
                </div>
              </div>
              <button
                onClick={() => setSuccessResult(null)}
                className={cn(
                  'p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  'hover:bg-[var(--color-surface)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Guide info */}
            <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--color-text-muted)]">Numero da guia</span>
                <span className="text-sm font-mono font-semibold text-[var(--color-text)]">{successResult.guideNumber}</span>
              </div>
              {successResult.paciente && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--color-text-muted)]">Paciente</span>
                  <span className="text-sm text-[var(--color-text)] text-right max-w-[60%] truncate">{successResult.paciente}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => void handleImportarGuia(successResult.guideNumber)}
                disabled={loadingImportar}
                className={cn(
                  'flex-1 py-2.5 rounded-lg font-medium text-sm text-white',
                  'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'flex items-center justify-center gap-2'
                )}
              >
                {loadingImportar ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Importar Guia
                  </>
                )}
              </button>

              <button
                onClick={() => setSuccessResult(null)}
                className={cn(
                  'px-4 py-2.5 rounded-lg font-medium text-sm',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
