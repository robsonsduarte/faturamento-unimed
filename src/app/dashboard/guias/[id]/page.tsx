'use client'

import { use, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, X, RotateCw, Camera, Loader2, Send, Smartphone, MessageSquare, FilePlus, Link2, Database, Trash2 } from 'lucide-react'
import { useGuia, useUpdateGuiaStatus } from '@/hooks/use-guias'
import { useProfile } from '@/hooks/use-profile'
import { StatusBadge } from '@/components/shared/status-badge'
import { Skeleton } from '@/components/shared/loading-skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { generateAvailableMonthsWithNext, formatMonthDisplay } from '@/lib/month-utils'
import { GUIDE_STATUS_FLOW, GUIDE_STATUS_TERMINAL } from '@/lib/constants'
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
  const [patientPhotos, setPatientPhotos] = useState<Array<{ sequence: number; url: string; token_used_at?: string | null }>>([])
  const [captureSlot, setCaptureSlot] = useState<number | null>(null)
  const [bioLoading, setBioLoading] = useState(false)
  const [bioResolving, setBioResolving] = useState(false)
  const [bioLogs, setBioLogs] = useState<ImportLog[]>([])
  const [selectedPhotoSeq, setSelectedPhotoSeq] = useState<number | null>(null)

  // Token WhatsApp states
  const [tokenMode, setTokenMode] = useState<'none' | 'biometria' | 'whatsapp'>('none')
  const [tokenSessionId, setTokenSessionId] = useState<string | null>(null)
  const [tokenMethods, setTokenMethods] = useState<{ aplicativo: boolean; sms: boolean } | null>(null)
  const [tokenPhones, setTokenPhones] = useState<{ value: string; text: string }[]>([])
  const [selectedMethod, setSelectedMethod] = useState<'aplicativo' | 'sms' | null>(null)
  const [selectedPhone, setSelectedPhone] = useState<string>('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [tokenStep, setTokenStep] = useState<'choose' | 'processing' | 'sms-select' | 'waiting' | 'waiting-manual' | 'done'>('choose')
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<string>('')
  const [manualToken, setManualToken] = useState('')
  const [tokenRequestId, setTokenRequestId] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [tokenRecebido, setTokenRecebido] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Mes referencia inline edit
  const [mesRefSaving, setMesRefSaving] = useState(false)

  async function handleMesReferenciaChange(newMes: string) {
    if (!guia || newMes === guia.mes_referencia) return
    setMesRefSaving(true)
    try {
      const res = await fetch(`/api/guias/${guia.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes_referencia: newMes }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro' })) as { error: string }
        toast.error(err.error)
        return
      }
      toast.success('Mes de referencia atualizado')
      refetch()
    } catch {
      toast.error('Erro ao atualizar mes de referencia')
    } finally {
      setMesRefSaving(false)
    }
  }

  // Cobrar atendimentos states
  const [cobrando, setCobrando] = useState(false)
  const [cobrarLogs, setCobrarLogs] = useState<ImportLog[]>([])
  const cobrarEndRef = useRef<HTMLDivElement>(null)
  const [cobrarShowCamera, setCobrarShowCamera] = useState(false)
  const [cobrarHasFoto, setCobrarHasFoto] = useState<boolean | null>(null)
  const [cobrarModalOpen, setCobrarModalOpen] = useState(false)
  const [cobrarPendentes, setCobrarPendentes] = useState<Array<{ date: string; start: string; end: string; checked: boolean; photoSequence?: number; _showPhotoPicker?: boolean }>>([])
  const [cobrarLoadingPendentes, setCobrarLoadingPendentes] = useState(false)

  // Bioface public link polling
  const [biofaceWaiting, setBiofaceWaiting] = useState(false)
  const biofaceBaselineRef = useRef<number>(0)
  const biofacePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Excluir cobrancas states
  const [excluindo, setExcluindo] = useState(false)
  const [excluirLogs, setExcluirLogs] = useState<ImportLog[]>([])
  const excluirEndRef = useRef<HTMLDivElement>(null)
  const [excluirModalOpen, setExcluirModalOpen] = useState(false)
  const [excluirLoadingLista, setExcluirLoadingLista] = useState(false)
  const [excluirLista, setExcluirLista] = useState<Array<{ execucaoId: number; sequencia: number; data: string; horaInicio: string; horaFim: string; checked: boolean }>>([])
  const [excluirConfirmAllOpen, setExcluirConfirmAllOpen] = useState(false)

  // CPro states
  const [cproModalOpen, setCproModalOpen] = useState(false)
  const [cproProfissionais, setCproProfissionais] = useState<Array<{ id: number; name: string }>>([])
  const [cproAgreements, setCproAgreements] = useState<Array<{ id: number; title: string; value: number | null }>>([])
  const [cproAgreement, setCproAgreement] = useState<number | ''>('')
  const [cproUser, setCproUser] = useState<number | ''>('')
  const [cproUserAttendant, setCproUserAttendant] = useState<number | ''>('')
  const [cproAtendimentos, setCproAtendimentos] = useState<Array<{ date: string; hour_start: string }>>([{ date: '', hour_start: '' }])
  const [cproMultiplicador, setCproMultiplicador] = useState<1 | 2>(2)
  const [cproSaving, setCproSaving] = useState(false)
  // CPro patient selection
  const [cproPatientId, setCproPatientId] = useState<number | ''>('')
  const [cproPatientName, setCproPatientName] = useState('')
  const [cproPatients, setCproPatients] = useState<Array<{ id: number; name: string }>>([])
  const [cproPatientLoading, setCproPatientLoading] = useState(false)

  // Buscar fotos existentes quando guia com numero_carteira carrega
  async function fetchPhotos(carteira: string): Promise<number> {
    try {
      const r = await fetch(`/api/biometria/foto/${encodeURIComponent(carteira)}`)
      const data = await r.json() as { exists: boolean; fotos?: Array<{ sequence: number; url: string; token_used_at?: string | null }> }
      if (data.exists && data.fotos) {
        setPatientPhotos(data.fotos)
        setCobrarHasFoto(data.fotos.length > 0)
        if (data.fotos.length === 1) setSelectedPhotoSeq(data.fotos[0].sequence)
        else setSelectedPhotoSeq(null)
        return data.fotos.length
      }
      setPatientPhotos([])
      setCobrarHasFoto(false)
      setSelectedPhotoSeq(null)
      return 0
    } catch {
      setPatientPhotos([])
      setCobrarHasFoto(false)
      setSelectedPhotoSeq(null)
      return 0
    }
  }

  useEffect(() => {
    if (!guia?.numero_carteira) return
    if (guia.status === 'TOKEN' || guia.status === 'PENDENTE') {
      fetchPhotos(guia.numero_carteira)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guia?.status, guia?.numero_carteira])

  // Polling apos envio do link bioface: detecta quando a foto do paciente chega
  useEffect(() => {
    if (!biofaceWaiting || !guia?.numero_carteira) return

    const carteira = guia.numero_carteira
    let stopped = false

    biofacePollRef.current = setInterval(async () => {
      if (stopped) return
      const count = await fetchPhotos(carteira)
      if (count > biofaceBaselineRef.current) {
        stopped = true
        if (biofacePollRef.current) clearInterval(biofacePollRef.current)
        biofacePollRef.current = null
        setBiofaceWaiting(false)
        toast.success('Foto recebida do paciente!')
      }
    }, 3000)

    // Timeout de 5 min para evitar polling infinito
    const timeoutId = setTimeout(() => {
      stopped = true
      if (biofacePollRef.current) clearInterval(biofacePollRef.current)
      biofacePollRef.current = null
      setBiofaceWaiting(false)
    }, 5 * 60 * 1000)

    return () => {
      stopped = true
      if (biofacePollRef.current) clearInterval(biofacePollRef.current)
      biofacePollRef.current = null
      clearTimeout(timeoutId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biofaceWaiting, guia?.numero_carteira])

  async function handleCapturarFoto(base64: string) {
    if (!guia) return
    setBioLoading(true)
    setCaptureSlot(null)
    try {
      const res = await fetch('/api/biometria/capturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia_id: guia.id, photo_base64: base64, sequence: captureSlot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (guia.numero_carteira) fetchPhotos(guia.numero_carteira)
      toast.success('Foto capturada e salva com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar foto')
    } finally {
      setBioLoading(false)
    }
  }

  async function handleResolverToken() {
    if (!guia) return
    if (patientPhotos.length > 1 && !selectedPhotoSeq) {
      toast.error('Selecione uma foto clicando nela antes de resolver o token')
      return
    }
    setBioResolving(true)
    setBioLogs([])
    try {
      const payload: Record<string, unknown> = { guia_id: guia.id }
      if (selectedPhotoSeq) payload.photo_sequence = selectedPhotoSeq
      const res = await fetch('/api/biometria/resolver-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
  async function handleIniciarToken(method: 'aplicativo' | 'sms') {
    if (!guia) return
    setSelectedMethod(method)
    setTokenLoading(true)
    setTokenStatus('Conectando ao SAW...')
    setTokenStep('processing')
    try {
      const res = await fetch('/api/biometria/iniciar-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia_id: guia.id, method }),
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
            if (evt.type === 'result') {
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
              setTokenPhones((evt.phones as { value: string; text: string }[]) ?? [])

              const phone = (evt.patientPhone as string) ?? (evt.phoneDisplay as string) ?? ''
              if (phone) setWhatsappPhone(phone)
              if (!evt.methods) setTokenMethods({ aplicativo: true, sms: true })

              if (method === 'sms') {
                // SMS: ir para selecao de telefone
                if ((evt.phones as { value: string; text: string }[] | undefined)?.length) {
                  setTokenStep('sms-select')
                  setTokenStatus('Selecione o telefone para envio do SMS')
                } else {
                  toast.error('Nenhum telefone encontrado no SAW para SMS. Tente novamente.')
                  setTokenStep('choose')
                  setTokenStatus('')
                }
              } else {
                // App: selecionar no SAW + enviar WhatsApp
                if (evt.whatsappSent && evt.requestId) {
                  setTokenRequestId(evt.requestId as string)
                  setTokenStep('waiting')
                  setTokenStatus('Mensagem enviada. Aguardando token...')
                  startPolling(evt.requestId as string)
                  startCountdown()
                  toast.success('WhatsApp enviado!')
                } else {
                  // Sem telefone ou envio falhou — campo manual
                  setTokenStep('waiting-manual')
                  setTokenStatus('Informe o telefone e envie o WhatsApp')
                }
              }
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
          atendimentos: selecionados.map((p) => ({ date: p.date, start: p.start, end: p.end, photoSequence: p.photoSequence })),
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

  async function handleAbrirExcluirModal() {
    if (!guia) return
    setExcluirModalOpen(true)
    setExcluirLoadingLista(true)
    setExcluirLista([])
    try {
      // 1. Reimportar guia primeiro (pega execucaoId fresh do DOM do SAW)
      toast.info('Reimportando guia para dados atualizados...')
      const importRes = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_numbers: [guia.guide_number] }),
      })
      if (importRes.body) {
        const reader = importRes.body.getReader()
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }
      const refreshed = await refetch()
      const refreshedGuia = refreshed.data

      // 2. Extrair lista de execucoes com execucaoId a partir de saw_data
      const sawData = refreshedGuia?.saw_data as Record<string, unknown> | null
      const detalhes = (sawData?.['procedimentosDetalhes'] ?? []) as Array<{
        sequencia?: number
        data?: string
        horaInicio?: string
        horaFim?: string
        execucaoId?: number | null
      }>

      const lista = detalhes
        .filter((d) => typeof d.execucaoId === 'number' && d.execucaoId > 0)
        .map((d) => ({
          execucaoId: d.execucaoId as number,
          sequencia: d.sequencia ?? 0,
          data: d.data ?? '',
          horaInicio: d.horaInicio ?? '',
          horaFim: d.horaFim ?? '',
          checked: true,
        }))

      if (lista.length === 0) {
        toast.info('Nenhuma cobranca encontrada para excluir.')
        setExcluirModalOpen(false)
      } else {
        setExcluirLista(lista)
      }
    } catch {
      toast.error('Erro ao buscar cobrancas para excluir')
      setExcluirModalOpen(false)
    } finally {
      setExcluirLoadingLista(false)
    }
  }

  async function streamExcluir(body: { guia_id: string; modo: 'all' | 'individual'; execucao_ids?: number[] }) {
    setExcluindo(true)
    setExcluirLogs([])
    try {
      const res = await fetch('/api/biometria/excluir-cobrancas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
            try { setExcluirLogs((prev) => [...prev, JSON.parse(line.slice(6)) as ImportLog]) } catch { /**/ }
          }
        }
      }
      await refetch()
      toast.success('Exclusao concluida')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na exclusao')
    } finally {
      setExcluindo(false)
    }
  }

  async function handleExcluirSelecionadas() {
    if (!guia) return
    const selecionadas = excluirLista.filter((e) => e.checked)
    if (selecionadas.length === 0) { toast.error('Selecione ao menos uma cobranca'); return }
    setExcluirModalOpen(false)
    await streamExcluir({
      guia_id: guia.id,
      modo: 'individual',
      execucao_ids: selecionadas.map((e) => e.execucaoId),
    })
  }

  async function handleConfirmarExcluirTodas() {
    if (!guia) return
    setExcluirConfirmAllOpen(false)
    setExcluirModalOpen(false)
    await streamExcluir({ guia_id: guia.id, modo: 'all' })
  }

  async function handleAbrirCproModal() {
    setCproModalOpen(true)
    const res = await fetch('/api/guias/cpro/profissionais')
    const data = await res.json()
    if (data.profissionais) setCproProfissionais(data.profissionais)
    if (data.agreements) setCproAgreements(data.agreements)

    const cd = guia?.cpro_data as Record<string, unknown> | null
    const sd = guia?.saw_data as Record<string, unknown> | null
    const codigoProc = (sd?.codigoProcedimentoSolicitado as string) ?? ''
    const ags = (data.agreements ?? []) as Array<{ id: number; title: string; value: number | null }>

    // Auto-match agreement by procedure code
    let matched = false
    if (codigoProc && ags.length > 0) {
      const match = ags.find((ag) => ag.title.startsWith(codigoProc))
      if (match) { setCproAgreement(match.id); matched = true }
      else toast.error(`Procedimento ${codigoProc} nao encontrado nos convenios Unimed. Selecione manualmente ou adicione no CPro.`)
    }
    // Fallback: from cpro_data
    if (!matched && cd && typeof cd.agreement_id === 'number') {
      setCproAgreement(cd.agreement_id)
    }

    // Pre-fill professional — match by most words in common
    if (cd && typeof cd.user_id === 'number') {
      setCproUser(cd.user_id)
      setCproUserAttendant(cd.user_id)
    } else if (guia?.nome_profissional && data.profissionais) {
      const profs = data.profissionais as Array<{ id: number; name: string }>
      const guiaProf = guia.nome_profissional.toLowerCase().trim()
      const exact = profs.find((p) => p.name.toLowerCase().trim() === guiaProf)
      if (exact) {
        setCproUser(exact.id); setCproUserAttendant(exact.id)
      } else {
        const words = guiaProf.split(/\s+/)
        let best: { id: number; name: string } | null = null
        let bestScore = 0
        for (const p of profs) {
          const pLower = p.name.toLowerCase()
          const score = words.filter((w) => pLower.includes(w)).length
          if (score > bestScore) { best = p; bestScore = score }
        }
        if (best && bestScore >= 2) { setCproUser(best.id); setCproUserAttendant(best.id) }
      }
    }

    // Fetch CPro patients and auto-select by guide patient name
    setCproPatientId('')
    setCproPatientName('')
    setCproPatients([])
    if (guia?.paciente) {
      setCproPatientLoading(true)
      fetch(`/api/guias/cpro/buscar-paciente?q=${encodeURIComponent(guia.paciente)}`)
        .then((r) => r.json())
        .then((d) => {
          const pts = (d.patients ?? []) as Array<{ id: number; name: string }>
          setCproPatients(pts)
          if (pts.length > 0) {
            // Auto-select: exact name match first, then best partial match
            const guiaNome = guia.paciente!.toLowerCase().trim()
            const exact = pts.find((p) => p.name.toLowerCase().trim() === guiaNome)
            if (exact) {
              setCproPatientId(exact.id)
              setCproPatientName(exact.name)
            } else {
              // Score by how many words from the guide name appear in patient name
              let best = pts[0]
              let bestScore = 0
              const guiaWords = guiaNome.split(/\s+/)
              for (const p of pts) {
                const pLower = p.name.toLowerCase()
                const score = guiaWords.filter((w) => pLower.includes(w)).length
                if (score > bestScore) { best = p; bestScore = score }
              }
              setCproPatientId(best.id)
              setCproPatientName(best.name)
            }
          }
        })
        .catch(() => {})
        .finally(() => setCproPatientLoading(false))
    }
  }

  async function handleSalvarCpro() {
    if (!guia || !cproUser || !cproAgreement || cproAtendimentos.some((a) => !a.date || !a.hour_start)) {
      toast.error('Preencha todos os campos')
      return
    }
    if (!cproPatientId) {
      toast.error('Selecione o paciente no CPro')
      return
    }
    setCproSaving(true)
    try {
      const res = await fetch('/api/guias/cpro/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guia_id: guia.id,
          user: cproUser,
          user_attendant: cproUserAttendant,
          atendimentos: cproAtendimentos,
          multiplicador: cproMultiplicador,
          agreement_id: cproAgreement,
          agreement_value: cproAgreements.find((a) => a.id === cproAgreement)?.value ?? 0,
          patient_id: cproPatientId,
        }),
      })
      const data = await res.json() as { success?: boolean; created?: number; patient_id?: number; error?: string | { message?: string } }
      if (data.success) {
        toast.success(`${data.created ?? 1} execucao(oes) criada(s) no CPro!`)
        // Persist selection + patient_id to cpro_data
        const selAg = cproAgreements.find((a) => a.id === cproAgreement)
        if (guia) {
          await fetch(`/api/guias/cpro/salvar-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guia_id: guia.id,
              agreement_id: cproAgreement,
              agreement_value: selAg?.value ?? 0,
              agreement_title: selAg?.title ?? '',
              user_id: cproUser,
              patient_id: data.patient_id ?? cproPatientId ?? null,
              patient_name: cproPatientName || null,
            }),
          }).catch(() => {})
        }
        setCproModalOpen(false)
        // Reimportar guia com logs visiveis (usa mesma logica do "Atualizar dados")
        await handleReimport()
      } else {
        const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message ?? JSON.stringify(data.error) ?? 'Erro ao salvar no CPro')
        toast.error(errMsg)
      }
    } catch { toast.error('Erro de conexao') }
    finally { setCproSaving(false) }
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

  const isTerminal = (GUIDE_STATUS_TERMINAL as readonly string[]).includes(guia.status)
  const statusIndex = isTerminal ? -1 : GUIDE_STATUS_FLOW.indexOf(guia.status as (typeof GUIDE_STATUS_FLOW)[number])
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Guia ${guia.guide_number}`}
        description={guia.paciente ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleAbrirCproModal}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-blue-600 text-white hover:bg-blue-700',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
              )}
            >
              <Database className="w-4 h-4" />
              Cadastrar no CPro
            </button>
            {guia.numero_carteira && (
              <button
                onClick={async () => {
                  toast.info('Buscando dados do CPro...')
                  try {
                    const res = await fetch(`/api/guias/cpro-data?guide_number=${guia.guide_number}`)
                    const data = await res.json()
                    console.log('[EmitirGuia] CPro data:', data)
                    const params = new URLSearchParams()
                    if (guia.paciente) params.set('paciente', guia.paciente)
                    if (data.success) {
                      if (data.carteira) params.set('carteira', data.carteira)
                      if (data.profissional?.nome) params.set('profissional', data.profissional.nome)
                      if (data.profissional?.conselho) params.set('prof_conselho', data.profissional.conselho)
                      if (data.profissional?.numeroConselho) params.set('prof_numero', data.profissional.numeroConselho)
                      if (data.profissional?.uf) params.set('prof_uf', data.profissional.uf)
                      if (data.profissional?.cbos) params.set('prof_cbo', data.profissional.cbos)
                      if (data.procedimentoCodigo) params.set('procedimento', data.procedimentoCodigo)
                      if (data.quantidade) params.set('quantidade', String(data.quantidade))
                      if (data.indicacaoClinica) params.set('cid', data.indicacaoClinica)
                    } else {
                      // Fallback: usar dados locais da guia
                      if (guia.numero_carteira) params.set('carteira', guia.numero_carteira)
                      if (guia.nome_profissional) params.set('profissional', guia.nome_profissional)
                      if (guia.indicacao_clinica) params.set('cid', guia.indicacao_clinica)
                    }
                    window.location.href = `/dashboard/guias/emitir?${params.toString()}`
                  } catch {
                    // Fallback direto
                    const params = new URLSearchParams()
                    if (guia.numero_carteira) params.set('carteira', guia.numero_carteira)
                    if (guia.nome_profissional) params.set('profissional', guia.nome_profissional)
                    if (guia.indicacao_clinica) params.set('cid', guia.indicacao_clinica)
                    window.location.href = `/dashboard/guias/emitir?${params.toString()}`
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                  'bg-[var(--color-primary)] text-white hover:opacity-90',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
                )}
              >
                <FilePlus className="w-4 h-4" />
                Emitir Nova Guia
              </button>
            )}
            <button
              onClick={() => {
                setConfirmModal({
                  show: true,
                  message: `Tem certeza que deseja excluir a guia ${guia.guide_number}? Esta acao nao pode ser desfeita.`,
                  onConfirm: async () => {
                    setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                    try {
                      const res = await fetch(`/api/guias/${guia.id}`, { method: 'DELETE' })
                      if (!res.ok) throw new Error('Falha ao excluir')
                      toast.success('Guia excluida com sucesso')
                      window.location.href = '/dashboard/guias'
                    } catch {
                      toast.error('Erro ao excluir guia')
                    }
                  },
                })
              }}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
                'bg-[var(--color-card)] border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500'
              )}
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
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
          </div>
        }
      />

      {/* Status pipeline */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Pipeline de Status</h2>
          {guia.status !== 'COMPLETA' && (
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
          {isTerminal ? (
            <span className={cn(
              'px-4 py-2 rounded-full text-xs font-semibold text-white',
              guia.status === 'CANCELADA' ? 'bg-red-500' : 'bg-orange-600'
            )}>
              {guia.status}
            </span>
          ) : (
            GUIDE_STATUS_FLOW.map((s, i) => {
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
            })
          )}
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
          {/* Mes Referencia — editavel inline */}
          <div className="flex justify-between items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] shrink-0">Mes Referencia</span>
            <select
              value={guia.mes_referencia ?? ''}
              onChange={(e) => void handleMesReferenciaChange(e.target.value)}
              disabled={mesRefSaving}
              className={cn(
                'px-2 py-1 rounded text-xs font-mono bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                mesRefSaving && 'opacity-50'
              )}
            >
              {generateAvailableMonthsWithNext().map((m) => (
                <option key={m} value={m}>{formatMonthDisplay(m)}</option>
              ))}
            </select>
          </div>
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
            { label: 'Procedimento', value: (guia.saw_data as Record<string, unknown> | null)?.codigoProcedimentoSolicitado as string | undefined, mono: true },
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
            className="px-5 py-4 border-b flex items-start justify-between gap-4"
            style={{ borderColor: 'var(--color-warning)', background: 'rgba(245, 158, 11, 0.08)' }}
          >
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
                Resolver Token de Atendimento
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Esta guia requer autenticacao antes de ser acessada no SAW.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch(
                    `/api/biometria/capturar-publico?action=generate-link&guia_id=${guia.id}`
                  )
                  const data = await res.json() as { url?: string; error?: string }
                  if (!res.ok) throw new Error(data.error ?? 'Erro ao gerar link')
                  if (data.url) {
                    await navigator.clipboard.writeText(data.url)
                    toast.success('Link copiado! Envie ao paciente via WhatsApp.')
                    // Inicia polling: registra contagem atual como baseline e aguarda nova foto
                    biofaceBaselineRef.current = patientPhotos.length
                    setBiofaceWaiting(true)
                  }
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Erro ao gerar link')
                }
              }}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0',
                'bg-[var(--color-card)] border border-[var(--color-border)]',
                'text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            >
              <Link2 className="w-4 h-4" />
              {biofaceWaiting ? 'Aguardando foto...' : 'Enviar LINK Bioface'}
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Escolha do modo */}
            {tokenMode === 'none' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => { setTokenMode('whatsapp'); setTokenStep('choose') }}
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
                  onClick={() => { setTokenMode('biometria') }}
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

            {/* === MODO BIOMETRIA — galeria de ate 5 fotos === */}
            {tokenMode === 'biometria' && (
              <div className="space-y-3">
                {captureSlot !== null ? (
                  <CameraCapture
                    onCapture={handleCapturarFoto}
                    onCancel={() => { setCaptureSlot(null); setTokenMode(patientPhotos.length === 0 ? 'none' : 'biometria') }}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        Fotos do Paciente ({patientPhotos.length}/5)
                      </h3>
                      {patientPhotos.length > 0 && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleResolverToken}
                            disabled={bioResolving}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                            style={{ background: 'var(--color-primary)' }}
                          >
                            {bioResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Resolver Token
                          </button>
                          <button
                            onClick={() => {
                              if (!guia?.numero_carteira) return
                              setConfirmModal({
                                show: true,
                                message: 'Tem certeza que deseja excluir todas as fotos de biometria deste paciente?',
                                onConfirm: () => {
                                  fetch(`/api/biometria/foto/${encodeURIComponent(guia.numero_carteira ?? '')}`, { method: 'DELETE' })
                                    .then(() => { setPatientPhotos([]); setCobrarHasFoto(false); toast.success('Fotos excluidas') })
                                    .catch(() => toast.error('Erro ao excluir fotos'))
                                  setConfirmModal({ show: false, message: '', onConfirm: () => {} })
                                },
                              })
                            }}
                            className="text-xs underline"
                            style={{ color: 'var(--color-danger)' }}
                          >
                            Excluir todas
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((seq) => {
                        const photo = patientPhotos.find((p) => p.sequence === seq)
                        const isSelected = selectedPhotoSeq === seq
                        const tokenMonth = photo?.token_used_at
                          ? `T-${new Date(photo.token_used_at).toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}`
                          : null
                        return (
                          <div
                            key={seq}
                            className={cn(
                              'aspect-video rounded-lg border-2 overflow-hidden relative cursor-pointer transition-all',
                              photo && isSelected
                                ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                                : 'border-[var(--color-border)]'
                            )}
                            style={{ background: 'var(--color-surface)' }}
                            onClick={() => { if (photo) setSelectedPhotoSeq(isSelected ? null : seq) }}
                          >
                            {photo ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.url} alt={`Foto ${seq}`} className="w-full h-full object-cover" />
                                {tokenMonth && (
                                  <span
                                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                                    style={{ background: 'rgba(139,92,246,0.85)' }}
                                    title={`Usada para token em ${new Date(photo.token_used_at!).toLocaleDateString('pt-BR')}`}
                                  >
                                    {tokenMonth}
                                  </span>
                                )}
                                {isSelected && (
                                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.25)' }}>
                                    <CheckCircle className="w-6 h-6 text-white drop-shadow-lg" />
                                  </div>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setCaptureSlot(seq) }}
                                  title="Refazer foto"
                                  className="absolute bottom-1 right-1 flex items-center justify-center rounded p-0.5"
                                  style={{ background: 'rgba(0,0,0,0.55)', color: 'var(--color-text-muted)' }}
                                >
                                  <RotateCw className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => { setCaptureSlot(seq) }}
                                disabled={bioLoading}
                                className="w-full h-full flex flex-col items-center justify-center gap-1"
                                style={{ color: 'var(--color-text-muted)' }}
                              >
                                {bioLoading && captureSlot === seq
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Camera className="w-4 h-4" />}
                                <span className="text-xs">Foto {seq}</span>
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {patientPhotos.length === 0 && (
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Clique em um slot para capturar a foto do paciente.
                      </p>
                    )}
                  </>
                )}
              </div>
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

                {/* Step: Escolher metodo (App ou SMS) */}
                {tokenStep === 'choose' && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Metodo:</p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleIniciarToken('aplicativo')}
                        disabled={tokenLoading}
                        className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:border-[var(--color-primary)]"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      >
                        <Smartphone className="w-4 h-4 inline mr-2" /> Aplicativo Unimed
                      </button>
                      <button
                        onClick={() => handleIniciarToken('sms')}
                        disabled={tokenLoading}
                        className="flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:border-[var(--color-primary)]"
                        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      >
                        <MessageSquare className="w-4 h-4 inline mr-2" /> SMS
                      </button>
                    </div>
                  </div>
                )}

                {/* Step: SMS — selecionar telefone */}
                {tokenStep === 'sms-select' && (
                  <div className="space-y-3">
                    {tokenPhones.length > 0 ? (
                      <>
                        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Selecione o telefone para SMS:</p>
                        <select
                          value={selectedPhone}
                          onChange={(e) => setSelectedPhone(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        >
                          <option value="">Selecione...</option>
                          {tokenPhones.map((p) => (
                            <option key={p.value} value={p.value}>{p.text}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: 'var(--color-warning)' }}>Nenhum telefone encontrado no SAW para SMS.</p>
                    )}

                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>WhatsApp do paciente:</label>
                        <input
                          type="tel"
                          placeholder="DDD + numero"
                          value={whatsappPhone}
                          onChange={(e) => setWhatsappPhone(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!tokenSessionId || !selectedPhone) { toast.error('Selecione o telefone'); return }
                          setTokenLoading(true)
                          setTokenStatus('Enviando SMS no SAW...')
                          try {
                            // Selecionar telefone + clicar enviar no SAW
                            await fetch('/api/biometria/selecionar-metodo', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ sessionId: tokenSessionId, method: 'sms', phone: selectedPhone }),
                            })
                            // Enviar WhatsApp
                            if (whatsappPhone) {
                              await handleEnviarWhatsApp()
                            }
                            setTokenStep('waiting')
                            startCountdown()
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Erro')
                          } finally {
                            setTokenLoading(false)
                          }
                        }}
                        disabled={tokenLoading || !selectedPhone || !whatsappPhone}
                        className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 shrink-0"
                        style={{ background: '#25d366' }}
                      >
                        {tokenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar e Aguardar
                      </button>
                    </div>
                  </div>
                )}

                {/* Step: App sem telefone — campo manual WhatsApp */}
                {tokenStep === 'waiting-manual' && (
                  <div className="space-y-3">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>WhatsApp do paciente:</label>
                        <input
                          type="tel"
                          placeholder="DDD + numero"
                          value={whatsappPhone}
                          onChange={(e) => setWhatsappPhone(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        />
                      </div>
                      <button
                        onClick={async () => {
                          if (!whatsappPhone) return
                          await handleEnviarWhatsApp()
                          setTokenStep('waiting')
                          startCountdown()
                        }}
                        disabled={!whatsappPhone || tokenLoading}
                        className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 shrink-0"
                        style={{ background: '#25d366' }}
                      >
                        <Send className="w-4 h-4" /> Enviar e Aguardar
                      </button>
                    </div>
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
              <button
                onClick={handleAbrirExcluirModal}
                disabled={cobrando || excluindo || (guia.procedimentos_realizados ?? 0) === 0}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-danger)' }}
                title={(guia.procedimentos_realizados ?? 0) === 0 ? 'Nenhuma cobranca para excluir' : 'Excluir cobrancas ja efetuadas'}
              >
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {excluindo ? 'Excluindo...' : 'Excluir Cobrancas'}
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
                    if (guia.numero_carteira) fetchPhotos(guia.numero_carteira)
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

          {/* Fotos mini preview */}
          {cobrarHasFoto && patientPhotos.length > 0 && !cobrarShowCamera && !cobrando && cobrarLogs.length === 0 && (
            <div className="px-5 py-3 flex items-center gap-2">
              {patientPhotos.slice(0, 5).map((p) => (
                <div key={p.sequence} className="shrink-0 w-16 h-9 overflow-hidden rounded border" style={{ borderColor: 'var(--color-border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Foto ${p.sequence}`} className="w-full h-full object-cover" />
                </div>
              ))}
              <p className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                {patientPhotos.length} foto{patientPhotos.length > 1 ? 's' : ''} disponivel{patientPhotos.length > 1 ? 'is' : ''} para biometria.
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

          {/* Pipeline de exclusao de cobrancas */}
          {(excluindo || excluirLogs.length > 0) && (
            <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
              <div className="px-4 py-2" style={{ background: 'var(--color-surface)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                  Pipeline de Exclusao de Cobrancas
                  {excluindo && <span className="ml-2 animate-pulse" style={{ color: 'var(--color-danger)' }}>em andamento...</span>}
                </p>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto space-y-1" style={{ background: '#0a0a0a' }}>
                {excluirLogs.map((log, i) => {
                  const colorMap = { success: '#4ade80', error: '#f87171', processing: '#f59e0b', info: '#94a3b8' }
                  return (
                    <div key={i} className="flex items-start gap-2 font-mono text-xs leading-5">
                      <span className="shrink-0 select-none" style={{ color: '#6b7280' }}>{log.timestamp}</span>
                      <span style={{ color: colorMap[log.type] }}>{log.message}</span>
                    </div>
                  )
                })}
                {excluindo && excluirLogs.length > 0 && (
                  <div className="flex items-center gap-2 font-mono text-xs mt-1">
                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#f59e0b' }} />
                    <span style={{ color: '#f59e0b' }}>Processando...</span>
                  </div>
                )}
                <div ref={excluirEndRef} />
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
                      {/* Seletor de foto */}
                      {patientPhotos.length > 0 && (
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              // Abrir popover com fotos
                              setCobrarPendentes((prev) => prev.map((pp, j) => j === i ? { ...pp, _showPhotoPicker: !pp._showPhotoPicker } : { ...pp, _showPhotoPicker: false }))
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded border text-xs shrink-0"
                            style={{ borderColor: p.photoSequence ? 'var(--color-primary)' : 'var(--color-border)', color: p.photoSequence ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
                            title={p.photoSequence ? `Foto ${p.photoSequence}` : 'Escolher foto (random)'}
                          >
                            <Camera className="w-3 h-3" />
                            {p.photoSequence ? `#${p.photoSequence}` : '?'}
                          </button>
                          {p._showPhotoPicker && (
                            <div className="absolute right-0 top-full mt-1 z-50 rounded-lg border p-2 shadow-lg" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)', minWidth: '200px' }}>
                              <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Escolher foto:</p>
                              <div className="flex gap-1 flex-wrap">
                                <button
                                  onClick={() => setCobrarPendentes((prev) => prev.map((pp, j) => j === i ? { ...pp, photoSequence: undefined, _showPhotoPicker: false } : pp))}
                                  className={cn('w-10 h-10 rounded border text-xs flex items-center justify-center', !p.photoSequence && 'ring-2 ring-[var(--color-primary)]')}
                                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                                  title="Aleatória"
                                >
                                  ?
                                </button>
                                {patientPhotos.map((foto) => (
                                  <button
                                    key={foto.sequence}
                                    onClick={() => setCobrarPendentes((prev) => prev.map((pp, j) => j === i ? { ...pp, photoSequence: foto.sequence, _showPhotoPicker: false } : pp))}
                                    className={cn('w-10 h-10 rounded border overflow-hidden', p.photoSequence === foto.sequence && 'ring-2 ring-[var(--color-primary)]')}
                                    style={{ borderColor: 'var(--color-border)' }}
                                    title={`Foto ${foto.sequence}`}
                                  >
                                    <img src={foto.url} alt={`Foto ${foto.sequence}`} className="w-full h-full object-cover" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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

      {/* Modal de selecao de cobrancas para excluir */}
      {excluirModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-lg rounded-xl border shadow-2xl"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-danger)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>Selecionar Cobrancas para Excluir</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Guia {guia.guide_number} — {guia.paciente}
                </p>
              </div>
              <button onClick={() => setExcluirModalOpen(false)} className="p-1 rounded hover:bg-white/10">
                <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>

            <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
              {excluirLoadingLista ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
                </div>
              ) : excluirLista.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhuma cobranca encontrada.
                </p>
              ) : (
                <div className="space-y-1">
                  <label className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--color-surface)]">
                    <input
                      type="checkbox"
                      checked={excluirLista.every((e) => e.checked)}
                      onChange={(e) => setExcluirLista((prev) => prev.map((x) => ({ ...x, checked: e.target.checked })))}
                      className="w-4 h-4 rounded accent-[var(--color-danger)]"
                    />
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                      Selecionar todas ({excluirLista.length})
                    </span>
                  </label>

                  <div className="border-t my-1" style={{ borderColor: 'var(--color-border)' }} />

                  {excluirLista.map((e, i) => (
                    <label
                      key={e.execucaoId}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--color-surface)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={e.checked}
                        onChange={() => setExcluirLista((prev) => prev.map((x, j) => j === i ? { ...x, checked: !x.checked } : x))}
                        className="w-4 h-4 rounded accent-[var(--color-danger)] shrink-0"
                      />
                      <span className="text-xs font-mono shrink-0" style={{ color: 'var(--color-text-muted)', width: 24 }}>
                        #{e.sequencia}
                      </span>
                      <span className="text-sm font-mono" style={{ color: 'var(--color-text)' }}>
                        {e.data}
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        {e.horaInicio}{e.horaFim ? ` - ${e.horaFim}` : ''}
                      </span>
                      <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                        id {e.execucaoId}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {excluirLista.filter((e) => e.checked).length} de {excluirLista.length} selecionada(s)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setExcluirModalOpen(false)}
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setExcluirConfirmAllOpen(true)}
                  disabled={excluirLista.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir todas ({excluirLista.length})
                </button>
                <button
                  onClick={handleExcluirSelecionadas}
                  disabled={excluirLista.filter((e) => e.checked).length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: 'var(--color-danger)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir selecionadas ({excluirLista.filter((e) => e.checked).length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmacao dupla — Excluir todas */}
      {excluirConfirmAllOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-md rounded-xl border shadow-2xl"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-danger)' }}
          >
            <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ background: 'rgba(239, 68, 68, 0.15)' }}
                >
                  <Trash2 className="w-5 h-5" style={{ color: 'var(--color-danger)' }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-danger)' }}>
                    Confirmar exclusao de todas as cobrancas
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Esta acao nao pode ser desfeita
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm" style={{ color: 'var(--color-text)' }}>
                Voce esta prestes a remover <strong>{excluirLista.length}</strong> cobranca(s) da guia{' '}
                <strong>{guia.guide_number}</strong> ({guia.paciente}) diretamente no SAW.
              </p>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                O sistema vai chamar <code>removerProcedimentosExecutados()</code> no SAW, verificar o resultado, e atualizar o banco de dados.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setExcluirConfirmAllOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarExcluirTodas}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--color-danger)' }}
              >
                <Trash2 className="w-4 h-4" />
                Sim, excluir todas
              </button>
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
      {/* Modal Cadastrar no CPro */}
      {cproModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="mx-4 w-full max-w-lg rounded-xl border shadow-2xl"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-primary)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>Cadastrar no CPro</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Guia {guia.guide_number} — {guia.paciente}
                </p>
              </div>
              <button onClick={() => setCproModalOpen(false)} className="p-1 rounded hover:bg-white/10">
                <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4 max-h-[460px] overflow-y-auto">
              {/* Profissional Executante */}
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Profissional Executante
                </label>
                <select
                  value={cproUser}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value)
                    setCproUser(val)
                    setCproUserAttendant(val)
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  <option value="">Selecione...</option>
                  {cproProfissionais.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Quem Atende */}
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Quem Atende
                </label>
                <select
                  value={cproUserAttendant}
                  onChange={(e) => setCproUserAttendant(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  <option value="">Selecione...</option>
                  {cproProfissionais.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Procedimento / Convenio */}
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Procedimento
                </label>
                <select
                  value={cproAgreement}
                  onChange={(e) => setCproAgreement(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  <option value="">Selecione...</option>
                  {cproAgreements.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.title} {ag.value != null ? `(R$ ${Number(ag.value).toFixed(2).replace('.', ',')})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dobrar cobranca */}
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Dobrar cobranca</span>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {cproMultiplicador === 2 ? 'Valor x2 (Psicologia, Fono, Nutricao...)' : 'Valor x1 (Psicomotricidade, Musicoterapia)'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCproMultiplicador((prev) => prev === 2 ? 1 : 2)}
                  className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                  style={{ background: cproMultiplicador === 2 ? 'var(--color-primary)' : 'var(--color-border)' }}
                >
                  <span
                    className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: cproMultiplicador === 2 ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>

              {/* Paciente — select CPro */}
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Paciente
                </label>
                <select
                  value={cproPatientId}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' as const : Number(e.target.value)
                    setCproPatientId(val)
                    const found = cproPatients.find((p) => p.id === val)
                    setCproPatientName(found?.name ?? '')
                  }}
                  disabled={cproPatientLoading}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  <option value="">{cproPatientLoading ? 'Buscando...' : 'Selecione...'}</option>
                  {cproPatients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Atendimentos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                    Atendimentos
                  </label>
                  <button
                    type="button"
                    disabled={cproAtendimentos.length >= (guia.quantidade_autorizada ?? 4)}
                    onClick={() => setCproAtendimentos((prev) => {
                      const last = prev[prev.length - 1]
                      let nextDate = ''
                      if (last?.date) {
                        const d = new Date(last.date + 'T12:00:00')
                        d.setDate(d.getDate() + 7)
                        nextDate = d.toISOString().slice(0, 10)
                      }
                      return [...prev, { date: nextDate, hour_start: last?.hour_start ?? '' }]
                    })}
                    className="text-xs px-2 py-1 rounded border disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {cproAtendimentos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="date"
                        value={a.date}
                        onChange={(e) => setCproAtendimentos((prev) => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        className="flex-1 rounded-lg border px-3 py-2 text-sm font-mono"
                        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      />
                      <input
                        type="time"
                        value={a.hour_start}
                        onChange={(e) => setCproAtendimentos((prev) => prev.map((x, j) => j === i ? { ...x, hour_start: e.target.value } : x))}
                        className="w-[110px] rounded-lg border px-3 py-2 text-sm font-mono"
                        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      />
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setCproAtendimentos((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1.5 rounded hover:bg-white/10 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {guia.quantidade_autorizada && (
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Maximo: {guia.quantidade_autorizada} atendimento(s) autorizado(s)
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setCproModalOpen(false)}
                className="rounded-lg border px-4 py-2 text-sm"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarCpro}
                disabled={cproSaving}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {cproSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {cproSaving ? 'Salvando...' : 'Salvar no CPro'}
              </button>
            </div>
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
