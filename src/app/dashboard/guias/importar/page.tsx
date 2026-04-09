'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Loader2, TerminalSquare, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'
import { generateAvailableMonthsWithNext, formatMonthDisplay, getCurrentMonth } from '@/lib/month-utils'
import { useProfile } from '@/hooks/use-profile'
import type { ImportLog } from '@/lib/types'

interface ImportStats {
  total: number
  success: number
  errors: number
  elapsed: string
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

const REIMPORT_STATUSES = [
  { value: 'PENDENTE', label: 'PENDENTE' },
  { value: 'CPRO', label: 'CPRO' },
  { value: 'TOKEN', label: 'TOKEN' },
] as const

type ReimportStatus = (typeof REIMPORT_STATUSES)[number]['value']

export default function ImportarGuiasPage() {
  const searchParams = useSearchParams()
  const { data: profile } = useProfile()
  const isVisualizador = profile?.role === 'visualizador'
  const [loading, setLoading] = useState(false)
  const [guideNumbers, setGuideNumbers] = useState('')
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const logEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  // Mes de referencia
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth())

  // Re-importar guias existentes
  const [selectedStatuses, setSelectedStatuses] = useState<ReimportStatus[]>(['PENDENTE'])
  const [loadingPendentes, setLoadingPendentes] = useState(false)
  const [pendentesInfo, setPendentesInfo] = useState<{ loaded: number; total: number; statuses: string[] } | null>(null)

  // Auto-carregar pendentes ou guias de validacao via query params
  useEffect(() => {
    if (searchParams.get('mode') === 'pendentes') {
      void handleCarregarPendentes()
    }
    // Pre-preencher guias da validacao de duplicatas (?guias=123,456,789)
    const guiasParam = searchParams.get('guias')
    if (guiasParam) {
      const nums = guiasParam.split(',').filter(Boolean)
      if (nums.length > 0) {
        setGuideNumbers(nums.join('\n'))
        toast.info(`${nums.length} guia(s) carregada(s) para reimportacao (validacao de duplicatas)`)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleStatus(value: ReimportStatus) {
    setSelectedStatuses((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    )
  }

  async function handleCarregarPendentes() {
    if (loadingPendentes) return // guard contra double-click
    if (selectedStatuses.length === 0) {
      toast.error('Selecione ao menos um status')
      return
    }

    setLoadingPendentes(true)
    setPendentesInfo(null)

    try {
      const params = new URLSearchParams({
        statuses: selectedStatuses.join(','),
        mes: mesReferencia,
      })
      const res = await fetch(`/api/guias/pendentes?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao carregar guias' })) as { error: string }
        throw new Error(err.error)
      }

      const json = await res.json() as { guide_numbers: string[]; total: number; loaded: number }

      setGuideNumbers(json.guide_numbers.join('\n'))
      setPendentesInfo({ loaded: json.loaded, total: json.total, statuses: [...selectedStatuses] })

      if (json.loaded === 0) {
        toast.info('Nenhuma guia encontrada para os status selecionados')
      } else {
        toast.success(`${json.loaded} guia(s) carregada(s)`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar guias pendentes'
      toast.error(msg)
    } finally {
      setLoadingPendentes(false)
    }
  }

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const appendLog = useCallback((log: ImportLog) => {
    setLogs((prev) => [...prev, log])
  }, [])

  async function handleImportar() {
    if (loading) return

    const numbers = guideNumbers
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean)

    if (numbers.length === 0) {
      toast.error('Informe ao menos um numero de guia')
      return
    }

    setLoading(true)
    setLogs([])
    setStats(null)
    setProgress({ current: 0, total: numbers.length })

    const abort = new AbortController()
    abortRef.current = abort
    const startTime = Date.now()

    try {
      const response = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_numbers: numbers }),
        signal: abort.signal,
      })

      if (!response.ok || !response.body) {
        const err = await response.json().catch(() => ({ error: 'Erro ao iniciar importacao' })) as { error: string }
        throw new Error(err.error)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let successCount = 0
      let errorCount = 0
      let processed = 0

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

            const log: ImportLog = {
              type: parsed.type,
              message: parsed.message,
              timestamp: parsed.timestamp,
              guide_number: parsed.guide_number,
            }

            appendLog(log)

            if (parsed.type === 'success' && parsed.guide_number) {
              successCount++
              processed++
              setProgress({ current: processed, total: numbers.length })
            } else if (parsed.type === 'error' && parsed.guide_number) {
              errorCount++
              processed++
              setProgress({ current: processed, total: numbers.length })
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      setStats({ total: numbers.length, success: successCount, errors: errorCount, elapsed })
      setProgress({ current: numbers.length, total: numbers.length })
      queryClient.invalidateQueries({ queryKey: ['guias'] })

      if (successCount > 0) {
        toast.success(`${successCount} guia(s) importada(s) com sucesso`)
      } else {
        toast.info('Nenhuma guia foi importada')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        appendLog({ type: 'error', message: 'Importacao cancelada pelo usuario.', timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }) })
      } else {
        const msg = err instanceof Error ? err.message : 'Erro ao importar'
        appendLog({ type: 'error', message: `Erro fatal: ${msg}`, timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }) })
        toast.error(msg)
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function handleCancelar() {
    abortRef.current?.abort()
  }

  const totalGuides = guideNumbers.split('\n').filter((n) => n.trim()).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Guias"
        description="Coleta guias do portal SAW com log em tempo real"
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

      {/* Progress bar */}
      {loading && progress.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>Progresso</span>
            <span>{progress.current}/{progress.total} guias</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-surface)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel: input */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">

          {/* Re-importar guias existentes (oculto para visualizador) */}
          {!isVisualizador && <div className="space-y-3 pb-4 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Re-importar guias existentes</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Carrega numeros de guias ja cadastradas pelo status selecionado.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Mes de Referencia</label>
              <select
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
                disabled={loading || loadingPendentes}
                className={cn(
                  'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-sm text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50'
                )}
              >
                <option value="todos">Todos os meses</option>
                {generateAvailableMonthsWithNext().map((m) => (
                  <option key={m} value={m}>{formatMonthDisplay(m)}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              {REIMPORT_STATUSES.map(({ value, label }) => {
                const active = selectedStatuses.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleStatus(value)}
                    disabled={loading || loadingPendentes}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      active
                        ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-3 h-3 rounded-sm border flex items-center justify-center shrink-0',
                        active
                          ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                          : 'border-[var(--color-border)]'
                      )}
                    >
                      {active && (
                        <svg viewBox="0 0 10 10" className="w-2 h-2 text-white fill-current">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleCarregarPendentes()}
                disabled={loading || loadingPendentes || selectedStatuses.length === 0}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
                  'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {loadingPendentes ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Carregar Guias
              </button>

              {pendentesInfo && pendentesInfo.loaded > 0 && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  <span className="font-semibold text-[var(--color-text)]">{pendentesInfo.loaded}</span>
                  {' carregada'}
                  {pendentesInfo.loaded !== 1 ? 's' : ''}
                  {' de '}
                  <span className="font-semibold text-[var(--color-text)]">{pendentesInfo.total}</span>
                  {' '}
                  {pendentesInfo.statuses.join(', ')}
                </span>
              )}
            </div>
          </div>}

          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              {isVisualizador ? 'Numero da guia' : 'Numeros de guia'}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {isVisualizador
                ? 'Informe o numero da guia para importar.'
                : 'Um numero por linha. Deixe em branco para buscar todas as pendentes.'}
            </p>
          </div>

          {isVisualizador ? (
            <input
              type="text"
              inputMode="numeric"
              value={guideNumbers}
              onChange={(e) => setGuideNumbers(e.target.value.replace(/\D/g, ''))}
              placeholder="123456789"
              disabled={loading}
              className={cn(
                'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'disabled:opacity-50'
              )}
            />
          ) : (
            <textarea
              value={guideNumbers}
              onChange={(e) => setGuideNumbers(e.target.value)}
              placeholder={'123456789\n987654321\n...'}
              rows={10}
              disabled={loading}
              className={cn(
                'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'resize-none disabled:opacity-50'
              )}
            />
          )}

          {totalGuides > 0 && !loading && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {totalGuides} guia{totalGuides !== 1 ? 's' : ''} para importar
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImportar}
              disabled={loading || totalGuides === 0}
              className={cn(
                'flex-1 py-2.5 rounded-lg font-medium text-sm text-white',
                'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Iniciar Importacao
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

          {/* Summary stats after completion */}
          {stats && !loading && (
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border)]">
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--color-text)]">{stats.total}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Total</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--color-success)]">{stats.success}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Importadas</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[var(--color-danger)]">{stats.errors}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Erros</p>
              </div>
              <div className="col-span-3 text-center">
                <p className="text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  Tempo total: {stats.elapsed}s
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel: real-time log console */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <TerminalSquare className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Log de importacao</span>
            {loading && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[#f0c040]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f0c040] animate-pulse" />
                Ao vivo
              </span>
            )}
            {!loading && stats && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[#4ade80]">
                {stats.errors === 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-[#f87171]" />
                )}
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
                Aguardando inicio da importacao...
              </p>
            )}

            {logs.map((log, i) => (
              <LogLine key={i} log={log} />
            ))}

            {loading && logs.length === 0 && (
              <p className="text-[#f0c040]">Conectando...</p>
            )}

            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
