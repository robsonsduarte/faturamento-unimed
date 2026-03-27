'use client'

import { use, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, X, RotateCw, Camera, Loader2, Send, Smartphone, MessageSquare } from 'lucide-react'
import { useGuia, useUpdateGuiaStatus } from '@/hooks/use-guias'
import { useProfile } from '@/hooks/use-profile'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { GUIDE_STATUS_FLOW } from '@/lib/constants'
import type { GuideStatus } from '@/lib/constants'
import type { ImportLog } from '@/lib/types'
import { CameraCapture } from '@/components/shared/camera-capture'
import { toast } from 'sonner'

interface Props {
  params: Promise<{ id: string }>
}

export default function GuiaDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: guia, isLoading, error, refetch } = useGuia(id)
  const updateStatus = useUpdateGuiaStatus()
  const { data: profile } = useProfile()
  const isVisualizador = profile?.role === 'visualizador'
  const [reimporting, setReimporting] = useState(false)
  const [logs, setLogs] = useState<ImportLog[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Modal confirmacao
  const [confirmModal, setConfirmModal] = useState<{ show: boolean; message: string; onConfirm: () => void }>({
    show: false, message: '', onConfirm: () => {},
  })

  // Biometria states
  const [showCamera, setShowCamera] = useState(false)
  const [bioPhoto, setBioPhoto] = useState<string | null>(null)
  const [bioLoading, setBioLoading] = useState(false)
  const [bioResolving, setBioResolving] = useState(false)
  const [bioLogs, setBioLogs] = useState<ImportLog[]>([])

  // Token WhatsApp states
  const [tokenMode, setTokenMode] = useState<'none' | 'biometria' | 'whatsapp'>('none')
  const [tokenSessionId, setTokenSessionId] = useState<string | null>(null)
  const [tokenMethods, setTokenMethods] = useState<{ aplicativo: boolean; sms: boolean } | null>(null)
  const [tokenPhones, setTokenPhones] = useState<string[]>([])
  const [selectedMethod, setSelectedMethod] = useState<'aplicativo' | 'sms' | null>(null)
  const [selectedPhone, setSelectedPhone] = useState<string>('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [tokenStep, setTokenStep] = useState<'choose' | 'method' | 'waiting' | 'done'>('choose')
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<string>('')
  const [manualToken, setManualToken] = useState('')
  const [tokenRequestId, setTokenRequestId] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenRecebido, setTokenRecebido] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cobrar atendimentos states
  const [cobrando, setCobrando] = useState(false)
  const [cobrarLogs, setCobrarLogs] = useState<ImportLog[]>([])
  const cobrarEndRef = useRef<HTMLDivElement>(null)
  const [cobrarShowCamera, setCobrarShowCamera] = useState(false)
  const [cobrarHasFoto, setCobrarHasFoto] = useState<boolean | null>(null)
  const [cobrarModalOpen, setCobrarModalOpen] = useState(false)
  const [cobrarPendentes, setCobrarPendentes] = useState<Array<{ date: string; start: string; end: string; checked: boolean }>>([])
  const [cobrarLoadingPendentes, setCobrarLoadingPendentes] = useState(false)

  // Buscar foto existente quando guia TOKEN ou PENDENTE carrega
  useEffect(() => {
    if (!guia?.numero_carteira) return
    if (guia.status === 'TOKEN' || guia.status === 'PENDENTE') {
      fetch(`/api/biometria/foto/${encodeURIComponent(guia.numero_carteira)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.exists && data.url) { setBioPhoto(data.url); setCobrarHasFoto(true) }
          else setCobrarHasFoto(false)
        })
        .catch(() => setCobrarHasFoto(false))
    }
  }, [guia?.status, guia?.numero_carteira])

  async function handleCapturarFoto(base64: string) {
    if (!guia) return
    setBioLoading(true)
    setShowCamera(false)
    try {
      const res = await fetch('/api/biometria/capturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia_id: guia.id, photo_base64: base64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (guia.numero_carteira) {
        const fotoRes = await fetch(`/api/biometria/foto/${encodeURIComponent(guia.numero_carteira)}`)
        const fotoData = await fotoRes.json()
        if (fotoData.exists && fotoData.url) setBioPhoto(fotoData.url)
      }
      toast.success('Foto capturada e salva com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar foto')
    } finally {
      setBioLoading(false)
    }
  }

  async function handleResolverToken() {
    if (!guia) return
    setBioResolving(true)
    setBioLogs([])
    try {
      const res = await fetch('/api/biometria/resolver-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia_id: guia.id }),
      })
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream nao disponivel')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { setBioLogs((prev) => [...prev, JSON.parse(line.slice(6)) as ImportLog]) } catch { /* */ }
          }
        }
      }
      await refetch()
      toast.success('Processo de biometria concluido')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao resolver token')
    } finally {
      setBioResolving(false)
    }
  }

  // WhatsApp token flow
  async function handleIniciarToken() {
    if (!guia) return
    setTokenLoading(true)
    setTokenStatus('Conectando ao SAW...')
    try {
      const res = await fetch('/api/biometria/iniciar-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia_id: guia.id }),
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream nao disponivel')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6)) as Record<string, unknown>
            if (evt.type === 'processing' || evt.type === 'success' || evt.type === 'info') {
              setTokenStatus(evt.message as string)
            }
            if (evt.type === 'error') {
              throw new Error(evt.message as string)
            }
            if (evt.type === 'result' && evt.success) {
              // Token ja resolvido — so reimportou
              if (evt.tokenAlreadyResolved) {
                setTokenStep('done')
                setTokenStatus('Token ja estava validado! Guia reimportada.')
                toast.success('Token ja validado. Guia atualizada.')
                await refetch()
                return
              }

              setTokenSessionId(evt.sessionId as string)
              setTokenMethods(evt.methods as { aplicativo: boolean; sms: boolean })
              setTokenPhones((evt.phones as string[]) ?? [])

              const phone = (evt.patientPhone as string) ?? (evt.phoneDisplay as string) ?? ''

              // Sempre mostrar tela de metodo para o operador escolher App/SMS
              if (phone) setWhatsappPhone(phone)
              if (!evt.methods) setTokenMethods({ aplicativo: true, sms: true })
              setTokenStep('method')
              setTokenStatus('Escolha o metodo de autenticacao')
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Stream nao disponivel') {
              throw parseErr
            }
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir token')
      setTokenStatus('')
      setTokenMode('none')
    } finally {
      setTokenLoading(false)
    }
  }

  async function handleSelecionarMetodo() {
    if (!tokenSessionId || !selectedMethod) return
    setTokenLoading(true)
    setTokenStatus(selectedMethod === 'sms' ? 'Enviando SMS...' : 'Selecionando aplicativo...')
    try {
      const res = await fetch('/api/biometria/selecionar-metodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tokenSessionId,
          method: selectedMethod,
          phone: selectedMethod === 'sms' ? selectedPhone : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTokenStatus(selectedMethod === 'sms'
        ? 'SMS enviado! Aguardando token do paciente...'
        : 'Aplicativo selecionado. Aguardando token do paciente...')
      setTokenStep('waiting')
      startCountdown()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao selecionar metodo')
    } finally {
      setTokenLoading(false)
    }
  }

  // Cleanup polling + countdown on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  async function handleAbrirCobrarModal() {
    if (!guia) return
    setCobrarModalOpen(true)
    setCobrarLoadingPendentes(true)
    setCobrarPendentes([])
    try {
      // 1. Reimportar guia primeiro (atualizar dados do SAW)
      toast.info('Reimportando guia para dados atualizados...')
      const importRes = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_numbers: [guia.guide_number] }),
      })
      // Consumir SSE da reimportacao (aguardar conclusao)
      if (importRes.body) {
        const reader = importRes.body.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }
      await refetch()

      // 2. Buscar atendimentos pendentes (CPro vs SAW atualizado)
      const res = await fetch(`/api/biometria/pendentes/${guia.guide_number}`)
      const data = await res.json()
      if (data.pendentes && data.pendentes.length > 0) {
        setCobrarPendentes(data.pendentes.map((p: { date: string; start: string; end: string }) => ({ ...p, checked: true })))
      } else {
        toast.info(`Nenhum atendimento pendente. ${data.realizados ?? 0} ja realizados no SAW.`)
        setCobrarModalOpen(false)
      }
    } catch {
      toast.error('Erro ao buscar atendimentos pendentes')
    } finally {
      setCobrarLoadingPendentes(false)
    }
  }

  async function handleCobrarSelecionados() {
    if (!guia) return
    const selecionados = cobrarPendentes.filter((p) => p.checked)
    if (selecionados.length === 0) { toast.error('Selecione ao menos um atendimento'); return }

    setCobrarModalOpen(false)
    setCobrando(true)
    setCobrarLogs([])
    try {
      const res = await fetch('/api/biometria/cobrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guia_id: guia.id,
          atendimentos: selecionados.map((p) => ({ date: p.date, start: p.start, end: p.end })),
        }),
      })
      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream nao disponivel')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { setCobrarLogs((prev) => [...prev, JSON.parse(line.slice(6)) as ImportLog]) } catch { /**/ }
          }
        }
      }
      await refetch()
      toast.success('Cobranca concluida')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na cobranca')
    } finally {
      setCobrando(false)
    }
  }

  function startCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(270) // 4:30 = 270 segundos
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          // Tempo esgotado — recarregar pagina
          window.location.reload()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function startPolling(requestId: string) {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/biometria/token-status/${requestId}`)
        if (!res.ok) return
        const data = await res.json() as { status: string; token_received?: string; error_message?: string }

        if (data.status === 'completed') {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
          setCountdown(0)
          setTokenStep('done')
          setTokenRecebido(data.token_received ?? null)
          setTokenError(null)
          setTokenStatus('Token validado! Guia desbloqueada.')
          setTokenLoading(false)
          toast.success(`Token ${data.token_received ?? ''} validado com sucesso!`)
          await refetch()
        } else if (data.status === 'failed') {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setTokenRecebido(data.token_received ?? null)
          setTokenError(data.error_message ?? 'Token invalido ou expirado')
          setTokenStatus('')
          setTokenLoading(false)
          toast.error(data.error_message ?? 'Token invalido')
        } else if (data.status === 'processing') {
          setTokenRecebido(data.token_received ?? null)
          setTokenStatus('Token recebido! Validando no SAW...')
        }
      } catch {
        // Silently continue polling
      }
    }, 5000)
  }

  async function handleEnviarWhatsApp() {
    if (!guia || !tokenSessionId || !selectedMethod || !whatsappPhone) return
    setTokenLoading(true)
    try {
      const res = await fetch('/api/biometria/enviar-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tokenSessionId,
          guia_id: guia.id,
          guide_number: guia.guide_number,
          paciente_nome: guia.paciente,
          phone_whatsapp: whatsappPhone,
          method: selectedMethod,
        }),
      })
      const data = await res.json() as { success?: boolean; error?: string; requestId?: string }
      if (!res.ok) throw new Error(data.error)

      toast.success('Mensagem enviada ao paciente!')
      setTokenStatus('Mensagem enviada. Aguardando resposta com o token...')

      // Iniciar polling para detectar quando o token chegar via webhook
      if (data.requestId) {
        setTokenRequestId(data.requestId)
        startPolling(data.requestId)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar WhatsApp')
    } finally {
      setTokenLoading(false)
    }
  }

  async function handleSubmeterTokenManual() {
    if (!tokenSessionId || !manualToken || !guia) return
    setTokenLoading(true)
    setTokenStatus('Validando token...')
    try {
      const res = await fetch('/api/biometria/submeter-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: tokenSessionId,
          token: manualToken,
          guia_id: guia.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('Token validado com sucesso!')
      setTokenStep('done')
      setTokenStatus('Token validado! Guia desbloqueada.')
      await refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Token invalido')
      setTokenStatus('Token invalido. Tente novamente.')
    } finally {
      setTokenLoading(false)
    }
  }

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const handleReimport = async () => {
    if (!guia || reimporting) return
    setReimporting(true)
    setLogs([])
    try {
      const res = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_numbers: [guia.guide_number] }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n').filter((l) => l.startsWith('data: '))
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.replace('data: ', '')) as ImportLog
              setLogs((prev) => [...prev, parsed])
            } catch { /* ignore */ }
          }
        }
      }
      refetch()
    } catch (err) {
      setLogs((prev) => [...prev, {
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao atualizar',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
      }])
    } finally {
      setReimporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !guia) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-danger)]">Guia nao encontrada</p>
        <Link href="/dashboard/guias" className="text-sm text-[var(--color-primary)] mt-2 inline-block">
          Voltar para guias
        </Link>
      </div>
    )
  }

  const statusIndex = GUIDE_STATUS_FLOW.indexOf(guia.status as GuideStatus)
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Guia ${guia.guide_number}`}
        description={guia.paciente ?? undefined}
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

      {/* Status pipeline */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Pipeline de Status</h2>
          {isVisualizador && guia.status !== 'COMPLETA' && (
            <button
              onClick={handleReimport}
              disabled={reimporting}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              <RotateCw className={cn('w-3.5 h-3.5', reimporting && 'animate-spin')} />
              {reimporting ? 'Atualizando...' : 'Atualizar dados'}
            </button>
          )}
        </div>

        {/* SSE Logs — real-time */}
        {logs.length > 0 && (
          <div className="mb-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
            <div className="max-h-32 overflow-y-auto px-3 py-2 space-y-1 text-xs font-mono">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-2',
                    log.type === 'error' && 'text-red-400',
                    log.type === 'success' && 'text-emerald-400',
                    log.type === 'processing' && 'text-amber-400',
                    log.type === 'info' && 'text-blue-400',
                  )}
                >
                  <span className="text-[var(--color-text-muted)] shrink-0">{log.timestamp}</span>
                  <span>{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Current step indicator when reimporting but no logs yet */}
        {reimporting && logs.length === 0 && (
          <p className="text-xs mb-3 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400">
            Conectando ao servidor...
          </p>
        )}

        {/* Final status after reimport completes */}
        {!reimporting && lastLog && (
          <p className={cn(
            'text-xs mb-3 px-3 py-2 rounded-lg',
            lastLog.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
          )}>
            {lastLog.message}
          </p>
        )}

        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {GUIDE_STATUS_FLOW.map((s, i) => {
            const isActive = s === guia.status
            const isDone = i < statusIndex
            return (
              <div key={s} className="flex items-center gap-1 shrink-0">
                {isVisualizador ? (
                  <span
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium',
                      isActive && 'bg-[var(--color-primary)] text-white',
                      isDone && !isActive && 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
                      !isActive && !isDone && 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                    )}
                  >
                    {isDone && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {s}
                  </span>
                ) : (
                  <button
                    onClick={() => updateStatus.mutate({ id: guia.id, status: s as GuideStatus })}
                    disabled={updateStatus.isPending}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                      isActive && 'bg-[var(--color-primary)] text-white',
                      isDone && !isActive && 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
                      !isActive && !isDone && 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-card)]'
                    )}
                  >
                    {isDone && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {s}
                  </button>
                )}
                {i < GUIDE_STATUS_FLOW.length - 1 && (
                  <div className={cn('w-6 h-0.5', isDone ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados da Guia */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Dados da Guia</h2>
          {[
            { label: 'Numero Operadora', value: guia.guide_number, mono: true },
            { label: 'Numero Prestador', value: guia.guide_number_prestador, mono: true },
            { label: 'Status', value: <StatusBadge status={guia.status as GuideStatus} /> },
            { label: 'Tipo', value: (
              <span className={cn(
                'px-1.5 py-0.5 rounded text-xs font-medium',
                guia.tipo_guia === 'Local' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
              )}>
                {guia.tipo_guia ?? 'N/A'}
              </span>
            ) },
            { label: 'Paciente', value: guia.paciente },
            { label: 'Carteira', value: guia.numero_carteira, mono: true },
            { label: 'Senha', value: guia.senha, mono: true },
            { label: 'Data Autorizacao', value: guia.data_autorizacao ? formatDate(guia.data_autorizacao) : null },
            { label: 'Validade Senha', value: guia.data_validade_senha ? formatDate(guia.data_validade_senha) : null },
            { label: 'Qtd Solicitada', value: guia.quantidade_solicitada },
            { label: 'Qtd Autorizada', value: guia.quantidade_autorizada },
            { label: 'Valor Total', value: formatCurrency(guia.valor_total), mono: true },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex justify-between items-start gap-2">
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">{label}</span>
              <span className={cn('text-xs text-right', mono ? 'font-mono text-[var(--color-text)]' : 'text-[var(--color-text)]')}>
                {value ?? '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Profissional */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Profissional e Atendimento</h2>
          {[
            { label: 'Profissional', value: guia.nome_profissional },
            { label: 'CNES', value: guia.cnes, mono: true },
            { label: 'Codigo Prestador', value: guia.codigo_prestador, mono: true },
            { label: 'Tipo Atendimento', value: guia.tipo_atendimento },
            { label: 'Indicacao Acidente', value: guia.indicacao_acidente },
            { label: 'Indicacao Clinica', value: guia.indicacao_clinica },
            { label: 'Procs. Realizados', value: guia.procedimentos_realizados },
            { label: 'Procs. Cadastrados', value: guia.procedimentos_cadastrados },
            { label: 'Token Biometrico', value: guia.token_biometrico ? 'Sim' : 'Nao' },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex justify-between items-start gap-2">
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">{label}</span>
              <span className={cn('text-xs text-right', mono ? 'font-mono text-[var(--color-text)]' : 'text-[var(--color-text)]')}>
                {value != null ? String(value) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resolver Token — apenas para guias TOKEN */}
      {guia.status === 'TOKEN' && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-warning)', background: 'var(--color-card)' }}
        >
          <div
            className="px-5 py-4 border-b"
            style={{ borderColor: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.08)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
              Resolver Token de Atendimento
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Esta guia requer autenticacao antes de ser acessada no SAW.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Escolha do modo */}
            {tokenMode === 'none' && !showCamera && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => { setTokenMode('whatsapp'); handleIniciarToken() }}
                  disabled={tokenLoading}
                  className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:border-[var(--color-primary)]"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                    <MessageSquare className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Token via WhatsApp</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Enviar instrucoes ao paciente por WhatsApp (App ou SMS)</p>
                  </div>
                </button>
                <button
                  onClick={() => { setTokenMode('biometria'); setShowCamera(true) }}
                  className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors hover:border-[var(--color-primary)]"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(14, 165, 233, 0.15)' }}>
                    <Camera className="w-5 h-5" style={{ color: 'var(--color-secondary)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Biometria Facial</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Capturar foto presencial do paciente</p>
                  </div>
                </button>
              </div>
            )}

            {/* === MODO BIOMETRIA === */}
            {tokenMode === 'biometria' && (
              <>
                {showCamera ? (
                  <CameraCapture onCapture={handleCapturarFoto} onCancel={() => { setShowCamera(false); setTokenMode('none') }} />
                ) : bioPhoto ? (
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)', width: 160 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={bioPhoto} alt="Foto biometria" className="w-full" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm" style={{ color: 'var(--color-text)' }}>Foto salva.</p>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={handleResolverToken}
                          disabled={bioResolving}
                          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                          style={{ background: 'var(--color-primary)' }}
                        >
                          {bioResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Resolver Token
                        </button>
                        <button onClick={() => setShowCamera(true)} className="text-xs underline" style={{ color: 'var(--color-text-muted)' }}>
                          Refazer
                        </button>
                        <button
                          onClick={() => {
                            if (!guia?.numero_carteira) return
                            setConfirmModal({
                              show: true,
                              message: 'Tem certeza que deseja excluir a foto de biometria deste paciente?',
                              onConfirm: () => {
                                fetch(`/api/biometria/foto/${encodeURIComponent(guia.numero_carteira ?? '')}`, { method: 'DELETE' })
                                  .then(() => { setBioPhoto(null); toast.success('Foto excluida') })
                                  .catch(() => toast.error('Erro ao excluir foto'))
                                setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                              },
                            })
                          }}
                          className="text-xs underline"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCamera(true)}
                    disabled={bioLoading}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    {bioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Capturar Foto
                  </button>
                )}
              </>
            )}

            {/* === MODO WHATSAPP === */}
            {tokenMode === 'whatsapp' && (
              <div className="space-y-4">
                {/* Status */}
                {tokenStatus && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {tokenLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Smartphone className="w-4 h-4" />
                    {tokenStatus}
                  </div>
                )}

                {/* Step: Escolher metodo + telefone + enviar (tudo junto) */}
                {tokenStep === 'method' && tokenMethods && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Metodo */}
                      <div className="space-y-2">
                        <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Metodo:</label>
                        <div className="flex gap-2">
                          {tokenMethods.aplicativo && (
                            <button
                              onClick={() => setSelectedMethod('aplicativo')}
                              className={cn(
                                'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                                selectedMethod === 'aplicativo' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                              )}
                            >
                              <Smartphone className="w-4 h-4 inline mr-1" /> App
                            </button>
                          )}
                          {tokenMethods.sms && (
                            <button
                              onClick={() => setSelectedMethod('sms')}
                              className={cn(
                                'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
                                selectedMethod === 'sms' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                              )}
                            >
                              <MessageSquare className="w-4 h-4 inline mr-1" /> SMS
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Telefone SMS (se SMS selecionado) */}
                      {selectedMethod === 'sms' && tokenPhones.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Telefone SAW:</label>
                          <select
                            value={selectedPhone}
                            onChange={(e) => setSelectedPhone(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                          >
                            <option value="">Selecione...</option>
                            {tokenPhones.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* WhatsApp do paciente + botao unico */}
                    {selectedMethod && (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                          <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>WhatsApp do paciente:</label>
                          <input
                            type="tel"
                            placeholder="DDD + numero (ex: 73999913940)"
                            value={whatsappPhone}
                            onChange={(e) => setWhatsappPhone(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                          />
                        </div>
                        <button
                          onClick={async () => {
                            await handleSelecionarMetodo()
                            if (whatsappPhone) await handleEnviarWhatsApp()
                          }}
                          disabled={tokenLoading || !whatsappPhone || (selectedMethod === 'sms' && !selectedPhone)}
                          className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 shrink-0"
                          style={{ background: '#25d366' }}
                        >
                          {tokenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Enviar e Aguardar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step: Aguardando token */}
                {tokenStep === 'waiting' && (
                  <div className="space-y-4">
                    {/* Confirmacao de envio + countdown */}
                    <div className="flex items-center gap-3 rounded-lg p-3" style={{ background: 'rgba(37, 211, 102, 0.1)' }}>
                      <MessageSquare className="w-5 h-5 shrink-0" style={{ color: '#25d366' }} />
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                          Mensagem enviada para {whatsappPhone}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          Aguardando o paciente responder com o token de 6 digitos...
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {countdown > 0 && (
                          <span
                            className="font-mono text-sm font-bold tabular-nums"
                            style={{ color: countdown < 60 ? 'var(--color-danger)' : 'var(--color-warning)' }}
                          >
                            {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                      </div>
                    </div>

                    {/* Input manual do token (fallback) */}
                    <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        Ou digite o token manualmente:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="000000"
                          maxLength={6}
                          value={manualToken}
                          onChange={(e) => setManualToken(e.target.value.replace(/\D/g, ''))}
                          className="w-28 rounded-lg border px-3 py-2 text-sm font-mono text-center tracking-[0.3em]"
                          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <button
                          onClick={handleSubmeterTokenManual}
                          disabled={tokenLoading || manualToken.length !== 6}
                          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          style={{ background: 'var(--color-primary)' }}
                        >
                          {tokenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Validar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Resultado do token (erro) */}
                {tokenError && tokenStep !== 'done' && (
                  <div className="rounded-lg border p-4 space-y-2" style={{ borderColor: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.08)' }}>
                    <div className="flex items-start gap-2">
                      <XCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-danger)' }} />
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--color-danger)' }}>Token nao validado</p>
                        {tokenRecebido && (
                          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Token recebido: <span className="font-mono font-semibold">{tokenRecebido}</span>
                          </p>
                        )}
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{tokenError}</p>
                        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                          Solicite ao paciente que gere um novo token e tente novamente. Se a sessao expirou, clique em &quot;Voltar&quot; e reinicie o processo.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step: Concluido */}
                {tokenStep === 'done' && (
                  <div className="rounded-lg border p-4 space-y-1" style={{ borderColor: 'var(--color-success)', background: 'rgba(34, 197, 94, 0.08)' }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
                      <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                        Token validado com sucesso!
                      </p>
                    </div>
                    {tokenRecebido && (
                      <p className="text-xs ml-7" style={{ color: 'var(--color-text-muted)' }}>
                        Token: <span className="font-mono font-semibold">{tokenRecebido}</span>
                      </p>
                    )}
                    <p className="text-xs ml-7" style={{ color: 'var(--color-text-muted)' }}>
                      Guia desbloqueada no SAW. Reimporte para atualizar o status.
                    </p>
                  </div>
                )}

                {/* Botao voltar */}
                {tokenStep !== 'done' && (
                  <button
                    onClick={() => { setTokenMode('none'); setTokenStep('choose'); setTokenSessionId(null); setTokenStatus('') }}
                    className="text-xs underline"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Voltar
                  </button>
                )}
              </div>
            )}

            {/* Pipeline de Biometria */}
            {(bioResolving || bioLogs.length > 0) && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                    Pipeline de Biometria
                    {bioResolving && <span className="ml-2 animate-pulse" style={{ color: 'var(--color-warning)' }}>em andamento...</span>}
                  </p>
                </div>
                <div className="p-3 max-h-64 overflow-y-auto space-y-1" style={{ background: '#0a0a0a' }}>
                  {bioLogs.map((log, i) => {
                    const prefixMap = { success: '  ', error: '  ', processing: '  ', info: '  ' }
                    const colorMap = { success: '#4ade80', error: '#f87171', processing: '#fbbf24', info: '#94a3b8' }
                    return (
                      <div key={i} className="flex items-start gap-2 font-mono text-xs leading-5">
                        <span className="shrink-0 select-none" style={{ color: colorMap[log.type] }}>{prefixMap[log.type]}</span>
                        <span className="shrink-0 select-none" style={{ color: '#6b7280' }}>{log.timestamp}</span>
                        <span style={{ color: colorMap[log.type] }}>{log.message}</span>
                      </div>
                    )
                  })}
                  {bioResolving && bioLogs.length > 0 && (
                    <div className="flex items-center gap-2 font-mono text-xs mt-1">
                      <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#fbbf24' }} />
                      <span style={{ color: '#fbbf24' }}>Aguardando...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cobrar Atendimentos — apenas para guias PENDENTE */}
      {guia.status === 'PENDENTE' && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: 'var(--color-secondary)', background: 'var(--color-card)' }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--color-secondary)', background: 'rgba(14, 165, 233, 0.06)' }}
          >
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-secondary)' }}>
                Cobrar Atendimentos
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Executar procedimentos pendentes no SAW com biometria
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!cobrando && (
                <button
                  onClick={() => setCobrarShowCamera(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {cobrarHasFoto ? 'Nova foto' : 'Capturar foto'}
                </button>
              )}
              <button
                onClick={handleAbrirCobrarModal}
                disabled={cobrando || cobrarHasFoto === false}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-secondary)' }}
                title={cobrarHasFoto === false ? 'Capture a foto primeiro' : ''}
              >
                {cobrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {cobrando ? 'Cobrando...' : 'Cobrar Atendimentos'}
              </button>
            </div>
          </div>

          {/* Camera de captura */}
          {cobrarShowCamera && (
            <div className="p-5">
              <CameraCapture
                onCapture={async (base64) => {
                  setCobrarShowCamera(false)
                  if (!guia) return
                  try {
                    const res = await fetch('/api/biometria/capturar', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ guia_id: guia.id, photo_base64: base64 }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    setCobrarHasFoto(true)
                    if (guia.numero_carteira) {
                      const fotoRes = await fetch(`/api/biometria/foto/${encodeURIComponent(guia.numero_carteira)}`)
                      const fotoData = await fotoRes.json()
                      if (fotoData.exists && fotoData.url) setBioPhoto(fotoData.url)
                    }
                    toast.success('Foto salva!')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Erro ao salvar foto')
                  }
                }}
                onCancel={() => setCobrarShowCamera(false)}
              />
            </div>
          )}

          {/* Sem foto — aviso */}
          {cobrarHasFoto === false && !cobrarShowCamera && !cobrando && cobrarLogs.length === 0 && (
            <div className="px-5 py-4">
              <p className="text-sm" style={{ color: 'var(--color-warning)' }}>
                Foto do paciente necessaria. Clique em &quot;Capturar foto&quot; acima.
              </p>
            </div>
          )}

          {/* Foto mini preview */}
          {cobrarHasFoto && bioPhoto && !cobrarShowCamera && !cobrando && cobrarLogs.length === 0 && (
            <div className="px-5 py-3 flex items-center gap-3">
              <div className="shrink-0 w-16 h-9 overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bioPhoto} alt="Foto" className="w-full h-full object-cover" />
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Foto disponivel para biometria.
              </p>
            </div>
          )}

          {/* Pipeline de cobranca */}
          {(cobrando || cobrarLogs.length > 0) && (
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-2" style={{ background: 'var(--color-surface)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  Pipeline de Cobranca
                  {cobrando && <span className="ml-2 animate-pulse" style={{ color: 'var(--color-secondary)' }}>em andamento...</span>}
                </p>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto space-y-1" style={{ background: '#0a0a0a' }}>
                {cobrarLogs.map((log, i) => {
                  const colorMap = { success: '#4ade80', error: '#f87171', processing: '#38bdf8', info: '#94a3b8' }
                  return (
                    <div key={i} className="flex items-start gap-2 font-mono text-xs leading-5">
                      <span className="shrink-0 select-none" style={{ color: '#6b7280' }}>{log.timestamp}</span>
                      <span style={{ color: colorMap[log.type] }}>{log.message}</span>
                    </div>
                  )
                })}
                {cobrando && cobrarLogs.length > 0 && (
                  <div className="flex items-center gap-2 font-mono text-xs mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#38bdf8' }} />
                    <span style={{ color: '#38bdf8' }}>Processando...</span>
                  </div>
                )}
                <div ref={cobrarEndRef} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de selecao de atendimentos para cobrar */}
      {cobrarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-lg rounded-xl border shadow-2xl"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-secondary)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-secondary)' }}>Selecionar Atendimentos</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Guia {guia.guide_number} — {guia.paciente}
                </p>
              </div>
              <button onClick={() => setCobrarModalOpen(false)} className="p-1 rounded hover:bg-white/10">
                <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>

            <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
              {cobrarLoadingPendentes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                </div>
              ) : cobrarPendentes.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum atendimento pendente encontrado.
                </p>
              ) : (
                <div className="space-y-1">
                  {/* Selecionar todos */}
                  <label className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--color-surface)]">
                    <input
                      type="checkbox"
                      checked={cobrarPendentes.every((p) => p.checked)}
                      onChange={(e) => setCobrarPendentes((prev) => prev.map((p) => ({ ...p, checked: e.target.checked })))}
                      className="w-4 h-4 rounded accent-[var(--color-secondary)]"
                    />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                      Selecionar todos ({cobrarPendentes.length})
                    </span>
                  </label>

                  <div className="border-t my-1" style={{ borderColor: 'var(--color-border)' }} />

                  {cobrarPendentes.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={p.checked}
                        onChange={() => setCobrarPendentes((prev) => prev.map((pp, j) => j === i ? { ...pp, checked: !pp.checked } : pp))}
                        className="w-4 h-4 rounded accent-[var(--color-secondary)] shrink-0"
                      />
                      <input
                        type="date"
                        value={p.date}
                        onChange={(e) => setCobrarPendentes((prev) => prev.map((pp, j) => j === i ? { ...pp, date: e.target.value } : pp))}
                        className="w-[130px] px-2 py-1 rounded border text-sm font-mono bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
                      />
                      <input
                        type="time"
                        value={p.start.substring(0, 5)}
                        onChange={(e) => setCobrarPendentes((prev) => prev.map((pp, j) => j === i ? { ...pp, start: e.target.value + ':00' } : pp))}
                        className="w-[90px] px-2 py-1 rounded border text-xs font-mono bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>-</span>
                      <input
                        type="time"
                        value={p.end.substring(0, 5)}
                        onChange={(e) => setCobrarPendentes((prev) => prev.map((pp, j) => j === i ? { ...pp, end: e.target.value + ':00' } : pp))}
                        className="w-[90px] px-2 py-1 rounded border text-xs font-mono bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {cobrarPendentes.filter((p) => p.checked).length} de {cobrarPendentes.length} selecionado(s)
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCobrarModalOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCobrarSelecionados}
                  disabled={cobrarPendentes.filter((p) => p.checked).length === 0}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--color-secondary)' }}
                >
                  <Send className="w-4 h-4" />
                  Cobrar {cobrarPendentes.filter((p) => p.checked).length} atendimento(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Procedimentos */}
      {guia.procedimentos && guia.procedimentos.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Procedimentos ({guia.procedimentos.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Seq.', 'Codigo', 'Descricao', 'Data', 'Qtd', 'Valor Unit.', 'Total', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--color-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {guia.procedimentos.map((proc) => (
                  <tr key={proc.id} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-4 py-2.5 font-mono">{proc.sequencia}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.codigo_procedimento ?? '—'}</td>
                    <td className="px-4 py-2.5 max-w-[200px] truncate">{proc.descricao ?? '—'}</td>
                    <td className="px-4 py-2.5">{proc.data_execucao ? formatDate(proc.data_execucao) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.quantidade_executada}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.valor_unitario != null ? formatCurrency(proc.valor_unitario) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono">{proc.valor_total != null ? formatCurrency(proc.valor_total) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-xs',
                        proc.status === 'Faturado' && 'bg-green-500/20 text-green-400',
                        proc.status === 'Conferido' && 'bg-blue-500/20 text-blue-400',
                        proc.status === 'Importado' && 'bg-slate-500/20 text-slate-400',
                      )}>
                        {proc.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal de Confirmacao */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-md rounded-xl border p-6 shadow-2xl space-y-4"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                <XCircle className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Confirmar acao</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal({ show: false, message: '', onConfirm: () => {} })}
                className="rounded-lg border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--color-danger)' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
