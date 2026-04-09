'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, Loader2, CheckCircle, X, TerminalSquare, Database } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { CidAutocomplete } from '@/components/shared/cid-autocomplete'
import { cn } from '@/lib/utils'
import { generateAvailableMonthsWithNext, formatMonthDisplay, getCurrentMonth } from '@/lib/month-utils'
import type { ImportLog } from '@/lib/types'
import type { CproProfissional } from '@/lib/saw/cpro-client'

/** CPro council code → SAW conselho code mapping */
/** CPro council codes = TISS/SAW codes (pad to 2 digits)
 * SAW: 04=CREFONO, 05=CREFITO, 06=CRM, 07=CRN, 09=CRP, 13=CREF */
const COUNCIL_MAP: Record<string, string> = {
  '4': '04', '04': '04', // CREFONO (Fonoaudiologia)
  '5': '05', '05': '05', // CREFITO (Fisio/TO/Psicomotricidade)
  '6': '06', '06': '06', // CRM (Medicina)
  '7': '07', '07': '07', // CRN (Nutrição)
  '9': '09', '09': '09', // CRP (Psicologia/Psicopedagogia)
  '13': '13',             // CREF (Educação Física)
}

/** CBOs das especialidades atendidas na clínica */
const CBO_OPTIONS = [
  { code: '251510', label: 'Psicólogo Clínico' },
  { code: '239425', label: 'Psicopedagogo' },
  { code: '223810', label: 'Fonoaudiólogo' },
  { code: '223710', label: 'Nutricionista' },
  { code: '226305', label: 'Musicoterapeuta' },
  { code: '223915', label: 'Psicomotricista' },
] as const

/** Detect log source from message content for color coding */
function detectSource(msg: string): 'saw' | 'cpro' | 'system' {
  const lower = msg.toLowerCase()
  if (lower.includes('saw') || lower.includes('sessao') || lower.includes('biometr') || lower.includes('xml')) return 'saw'
  if (lower.includes('cpro') || lower.includes('execu') || lower.includes('agreement') || lower.includes('verificac')) return 'cpro'
  return 'system'
}

function LogLine({ log }: { log: ImportLog }) {
  const isError = log.type === 'error'
  const source = detectSource(log.message)

  // Cores por fonte: SAW=verde, CPro=azul, Sistema=amarelo, Erro=vermelho
  const sourceColor = isError
    ? 'text-[#f87171]'
    : source === 'saw'
      ? 'text-[#4ade80]'
      : source === 'cpro'
        ? 'text-[#60a5fa]'
        : 'text-[#f0c040]'

  const prefixMap: Record<ImportLog['type'], string> = {
    info: '  ', processing: '~ ', success: '+ ', error: '! ',
  }
  const tsColor = isError ? 'text-[#f87171]' : 'text-[#6b7280]'

  return (
    <div className="flex gap-2 leading-5">
      <span className={cn('shrink-0 select-none', tsColor)}>[{log.timestamp}]</span>
      <span className={cn('shrink-0 select-none', sourceColor)}>{prefixMap[log.type]}</span>
      <span className={sourceColor}>{log.message}</span>
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
  const [quantidade, setQuantidade] = useState('4')
  const [indicacaoClinica, setIndicacaoClinica] = useState('')
  const [mesReferencia, setMesReferencia] = useState(getCurrentMonth())

  // CPro data (unified)
  const [cproProfissionais, setCproProfissionais] = useState<CproProfissional[]>([])
  const [cproAgreements, setCproAgreements] = useState<Array<{ id: number; title: string; value: number | null }>>([])
  const [selectedProf, setSelectedProf] = useState<number | ''>('')
  const [selectedCbo, setSelectedCbo] = useState('')
  const [selectedProfAttendant, setSelectedProfAttendant] = useState<number | ''>('')
  const [selectedAgreement, setSelectedAgreement] = useState<number | ''>('')
  const [cproMultiplicador, setCproMultiplicador] = useState<1 | 2>(2)
  const [cproAtendimentos, setCproAtendimentos] = useState<Array<{ date: string; hour_start: string }>>([{ date: '', hour_start: '' }])

  // Pipeline state
  const [pipelineStep, setPipelineStep] = useState<'idle' | 'emitindo' | 'importando' | 'cpro' | 'verificando' | 'done'>('idle')
  const [logs, setLogs] = useState<ImportLog[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const loading = pipelineStep !== 'idle' && pipelineStep !== 'done'

  const prof = typeof selectedProf === 'number' ? cproProfissionais.find((p) => p.id === selectedProf) : null

  // Auto-selecionar CBO quando profissional muda
  useEffect(() => {
    if (!prof) { setSelectedCbo(''); return }
    const cbos = prof.cbos?.trim() ?? ''
    // Se o CBO do CPro bate com algum da lista, selecionar
    const match = CBO_OPTIONS.find((o) => o.code === cbos)
    if (match) { setSelectedCbo(match.code); return }
    // Tentar por occupation_name
    const occLower = (prof.occupation_name ?? '').toLowerCase()
    const byName = CBO_OPTIONS.find((o) => occLower.includes(o.label.toLowerCase().slice(0, 6)))
    setSelectedCbo(byName?.code ?? cbos)
  }, [prof])
  const agreement = typeof selectedAgreement === 'number' ? cproAgreements.find((a) => a.id === selectedAgreement) : null
  // Extract procedure code from agreement title (e.g. "50000470 - Sessao...")
  const procedimentoCodigo = agreement?.title.match(/^(\d+)/)?.[1] ?? ''

  const appendLog = useCallback((log: ImportLog) => {
    setLogs((prev) => [...prev, log])
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  function nowTs() {
    return new Date().toLocaleTimeString('pt-BR', { hour12: false })
  }

  // Pre-fill from query params
  useEffect(() => {
    const p = searchParams
    if (p.get('paciente')) setPacienteNome(p.get('paciente')!)
    if (p.get('carteira')) setCarteiraSuffix(p.get('carteira')!.replace(/^0?865/, ''))
    if (p.get('quantidade')) setQuantidade(p.get('quantidade')!)
    if (p.get('cid')) setIndicacaoClinica(p.get('cid')!)
  }, [searchParams])

  // Load CPro data + auto-match from query params
  useEffect(() => {
    fetch('/api/guias/cpro/profissionais')
      .then((r) => r.json())
      .then((data: { profissionais?: CproProfissional[]; agreements?: Array<{ id: number; title: string; value: number | null }> }) => {
        const profs = data.profissionais ?? []
        const ags = data.agreements ?? []
        setCproProfissionais(profs)
        setCproAgreements(ags)

        // Auto-match profissional by name from query param
        const profName = searchParams.get('profissional')
        if (profName && profs.length > 0) {
          const firstName = profName.split(' ')[0].toLowerCase()
          const match = profs.find((p) => p.name.toLowerCase().includes(firstName))
          if (match) { setSelectedProf(match.id); setSelectedProfAttendant(match.id) }
        }

        // Auto-match agreement by procedure code from query param
        const procCode = searchParams.get('procedimento')
        if (procCode && ags.length > 0) {
          const match = ags.find((ag) => ag.title.startsWith(procCode))
          if (match) setSelectedAgreement(match.id)
        }
      })
      .catch(() => {})
  }, [searchParams])

  function validateForm(): string | null {
    if (!carteiraSuffix.trim()) return 'Informe o numero da carteira'
    if (carteiraSuffix.trim().length > 13) return 'Carteira deve ter no maximo 13 digitos'
    if (!selectedProf) return 'Selecione o profissional'
    if (!selectedAgreement) return 'Selecione o procedimento/convenio'
    if (!procedimentoCodigo) return 'Procedimento invalido'
    const qtd = parseInt(quantidade, 10)
    if (isNaN(qtd) || qtd < 1) return 'Quantidade deve ser maior que zero'
    if (cproAtendimentos.some((a) => !a.date || !a.hour_start)) return 'Preencha todas as datas e horarios'
    return null
  }

  async function readSSE(
    response: Response,
    onEvent: (evt: Record<string, unknown>) => void,
    signal: AbortSignal
  ) {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done || signal.aborted) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (!line.startsWith('data: ')) continue
        try { onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>) } catch { /* skip */ }
      }
    }
  }

  async function handleEmitir() {
    if (loading) return
    const error = validateForm()
    if (error) { toast.error(error); return }

    if (!prof) { toast.error('Profissional nao encontrado'); return }

    const carteira = carteiraSuffix.trim()
    const sawConselho = COUNCIL_MAP[prof.council_code ?? ''] ?? prof.council_code ?? '08'
    const cboToSend = selectedCbo || prof.occupation_name || prof.cbos || ''
    const sawCbo = CBO_OPTIONS.find((o) => o.code === cboToSend)?.label ?? cboToSend

    setLogs([])
    setPipelineStep('emitindo')

    const abort = new AbortController()
    abortRef.current = abort

    let guideNumber = ''
    let guiaId = ''
    let emissionFormData: Record<string, unknown> | null = null

    try {
      // ─── Step 1: Emit guide on SAW ───
      appendLog({ type: 'processing', message: '[SAW] Passo 1/4: Emitindo guia no SAW...', timestamp: nowTs() })

      const emitRes = await fetch('/api/guias/emitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carteira,
          profissional: {
            nome: prof.name,
            conselho: sawConselho,
            numeroConselho: prof.council_number ?? '',
            uf: prof.council_uf ?? '29',
            cbo: sawCbo,
          },
          procedimento_codigo: procedimentoCodigo,
          quantidade: parseInt(quantidade, 10),
          indicacao_clinica: indicacaoClinica.trim() || undefined,
        }),
        signal: abort.signal,
      })

      if (!emitRes.ok || !emitRes.body) {
        const err = await emitRes.json().catch(() => ({ error: 'Erro ao iniciar emissao' })) as { error: string }
        throw new Error(err.error)
      }

      await readSSE(emitRes, (evt) => {
        if (evt.type === 'result') {
          guideNumber = (evt.guideNumber ?? evt.guide_number ?? '') as string
          emissionFormData = (evt.formData ?? null) as Record<string, unknown> | null
          appendLog({ type: 'success', message: `[SAW] Guia ${guideNumber} emitida com sucesso!`, timestamp: nowTs() })
        } else {
          appendLog({ type: evt.type as ImportLog['type'], message: evt.message as string, timestamp: evt.timestamp as string })
        }
      }, abort.signal)

      if (!guideNumber) throw new Error('Emissao nao retornou numero da guia')

      // ─── Step 2: Import guide from SAW ───
      setPipelineStep('importando')
      appendLog({ type: 'processing', message: `[SAW] Passo 2/4: Importando guia ${guideNumber} do SAW...`, timestamp: nowTs() })

      const importRes = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide_numbers: [guideNumber], mes_referencia: mesReferencia, emission_form_data: emissionFormData, skip_cpro: true }),
        signal: abort.signal,
      })

      if (!importRes.ok || !importRes.body) {
        const err = await importRes.json().catch(() => ({ error: 'Erro ao importar' })) as { error: string }
        throw new Error(err.error)
      }

      await readSSE(importRes, (evt) => {
        if (evt.guia_id) guiaId = evt.guia_id as string
        appendLog({ type: evt.type as ImportLog['type'], message: evt.message as string, timestamp: evt.timestamp as string })
      }, abort.signal)

      if (!guiaId) throw new Error('Importacao nao retornou ID da guia')

      // ─── Step 3: Register in CPro ───
      setPipelineStep('cpro')
      appendLog({ type: 'processing', message: '[CPro] Passo 3/4: Cadastrando execucoes no CPro...', timestamp: nowTs() })

      const cproRes = await fetch('/api/guias/cpro/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guia_id: guiaId,
          user: selectedProf,
          user_attendant: selectedProfAttendant,
          atendimentos: cproAtendimentos,
          multiplicador: cproMultiplicador,
          agreement_id: selectedAgreement,
          agreement_value: agreement?.value ?? 0,
        }),
        signal: abort.signal,
      })

      const cproData = await cproRes.json() as { success?: boolean; created?: number; error?: string }

      if (cproData.success) {
        appendLog({ type: 'success', message: `[CPro] ${cproData.created ?? 0} execucao(oes) criada(s) no CPro!`, timestamp: nowTs() })
      } else {
        appendLog({ type: 'error', message: `[CPro] ${cproData.error ?? 'Erro desconhecido'}`, timestamp: nowTs() })
      }

      // ─── Step 4: Verify CPro registration + persist config ───
      setPipelineStep('verificando')
      appendLog({ type: 'processing', message: '[CPro] Passo 4/4: Verificando execucoes no CPro...', timestamp: nowTs() })

      const verifyRes = await fetch('/api/guias/cpro/verificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guia_id: guiaId,
          guide_number: guideNumber,
          agreement_id: selectedAgreement,
          agreement_value: agreement?.value ?? 0,
          agreement_title: agreement?.title ?? '',
          user_id: selectedProf,
        }),
        signal: abort.signal,
      })

      const verifyData = await verifyRes.json() as { success?: boolean; status?: string; procedimentos_cadastrados?: number; error?: string }

      if (verifyData.success) {
        appendLog({
          type: 'success',
          message: `[CPro] Verificacao OK: ${verifyData.procedimentos_cadastrados ?? 0} execucao(oes), status: ${verifyData.status}`,
          timestamp: nowTs(),
        })
      } else {
        appendLog({ type: 'error', message: `[CPro] Verificacao: ${verifyData.error ?? 'Erro desconhecido'}`, timestamp: nowTs() })
      }

      // ─── Done ───
      setPipelineStep('done')
      appendLog({ type: 'success', message: 'Pipeline completo! Redirecionando...', timestamp: nowTs() })
      toast.success('Guia emitida, importada e cadastrada no CPro!')
      setTimeout(() => router.push(`/dashboard/guias/${guiaId}`), 1500)

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        appendLog({ type: 'error', message: 'Operacao cancelada.', timestamp: nowTs() })
      } else {
        const msg = err instanceof Error ? err.message : 'Erro no pipeline'
        appendLog({ type: 'error', message: `Erro: ${msg}`, timestamp: nowTs() })
        toast.error(msg)
      }
      setPipelineStep('idle')
    } finally {
      abortRef.current = null
    }
  }

  const inputCls = cn(
    'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
    'text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
    'disabled:opacity-50'
  )
  const labelCls = 'text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emitir Guia"
        description="Emissao + importacao + cadastro CPro em pipeline unico"
        action={
          <Link href="/dashboard/guias"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel: form */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-140px)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Dados da Guia</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Preencha para emitir no SAW e cadastrar no CPro.</p>
          </div>

          {/* Mes de Referencia */}
          <div className="space-y-1.5">
            <label className={labelCls}>Mes de Referencia</label>
            <select value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)}
              disabled={loading} className={inputCls}>
              {generateAvailableMonthsWithNext().map((m) => (
                <option key={m} value={m}>{formatMonthDisplay(m)}</option>
              ))}
            </select>
          </div>

          {/* Paciente */}
          {pacienteNome && (
            <div className="space-y-1.5">
              <label className={labelCls}>Paciente</label>
              <div className={cn(inputCls, 'opacity-75')}>{pacienteNome}</div>
            </div>
          )}

          {/* Carteira */}
          <div className="space-y-1.5">
            <label className={labelCls}>Carteira</label>
            <div className="flex items-center gap-0">
              <span className="inline-flex items-center px-3 py-2.5 rounded-l-lg bg-[var(--color-surface)] border border-r-0 border-[var(--color-border)] text-sm font-mono text-[var(--color-text-muted)] select-none">
                {carteiraPrefix}
              </span>
              <input type="text" inputMode="numeric" maxLength={13} value={carteiraSuffix}
                onChange={(e) => setCarteiraSuffix(e.target.value.replace(/\D/g, ''))}
                placeholder="0000000000000" disabled={loading} className={cn(inputCls, 'rounded-l-none')} />
            </div>
          </div>

          {/* Profissional (unified CPro select) */}
          <div className="space-y-1.5">
            <label className={labelCls}>Profissional</label>
            <select value={selectedProf}
              onChange={(e) => { const v = e.target.value === '' ? '' as const : Number(e.target.value); setSelectedProf(v); setSelectedProfAttendant(v) }}
              disabled={loading} className={inputCls}>
              <option value="">Selecione...</option>
              {cproProfissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {prof && (
              <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)] px-1">
                <span>Conselho: {prof.council_code ?? '—'}</span>
                <span>Numero: {prof.council_number ?? '—'}</span>
                <span>UF: {prof.council_uf ?? '—'}</span>
              </div>
            )}
          </div>

          {/* CBOS */}
          {prof && (
            <div className="space-y-1.5">
              <label className={labelCls}>CBOS</label>
              <select value={selectedCbo}
                onChange={(e) => setSelectedCbo(e.target.value)}
                disabled={loading} className={inputCls}>
                <option value="">Selecione...</option>
                {CBO_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.code} — {o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quem Atende */}
          <div className="space-y-1.5">
            <label className={labelCls}>Quem Atende</label>
            <select value={selectedProfAttendant}
              onChange={(e) => setSelectedProfAttendant(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={loading} className={inputCls}>
              <option value="">Selecione...</option>
              {cproProfissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Procedimento (unified CPro agreement) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className={labelCls}>Procedimento</label>
              <select value={selectedAgreement}
                onChange={(e) => setSelectedAgreement(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={loading} className={inputCls}>
                <option value="">Selecione...</option>
                {cproAgreements.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.title} {ag.value != null ? `(R$ ${Number(ag.value).toFixed(2).replace('.', ',')})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Quantidade</label>
              <input type="number" min="1" max="99" value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)} disabled={loading} className={inputCls} />
            </div>
          </div>

          {/* Indicacao Clinica */}
          <div className="space-y-1.5">
            <label className={labelCls}>Indicacao Clinica <span className="normal-case font-normal">(opcional)</span></label>
            <CidAutocomplete value={indicacaoClinica} onChange={setIndicacaoClinica}
              disabled={loading} className={inputCls} />
          </div>

          {/* CPro Section */}
          <div className="border-t border-[var(--color-border)] pt-5 mt-2">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Cobranças CPro</h2>
            </div>

            <div className="space-y-4">
              {/* Toggle dobrar */}
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Dobrar cobranca</span>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {cproMultiplicador === 2 ? 'Valor x2 (Psicologia, Fono, Nutricao...)' : 'Valor x1 (Psicomotricidade, Musicoterapia)'}
                  </p>
                </div>
                <button type="button" onClick={() => setCproMultiplicador((prev) => prev === 2 ? 1 : 2)}
                  className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
                  style={{ background: cproMultiplicador === 2 ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
                    style={{ transform: cproMultiplicador === 2 ? 'translateX(20px)' : 'translateX(0)' }} />
                </button>
              </div>

              {/* Atendimentos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>Atendimentos</label>
                  <button type="button" disabled={loading}
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
                    className="text-xs px-2 py-1 rounded border disabled:opacity-40"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                    + Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {cproAtendimentos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="date" value={a.date}
                        onChange={(e) => setCproAtendimentos((prev) => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        disabled={loading} className={cn(inputCls, 'flex-1 font-mono')} />
                      <input type="time" value={a.hour_start}
                        onChange={(e) => setCproAtendimentos((prev) => prev.map((x, j) => j === i ? { ...x, hour_start: e.target.value } : x))}
                        disabled={loading} className={cn(inputCls, 'w-[110px] font-mono')} />
                      {i > 0 && (
                        <button type="button" onClick={() => setCproAtendimentos((prev) => prev.filter((_, j) => j !== i))}
                          className="p-1.5 rounded hover:bg-white/10 shrink-0">
                          <X className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="flex gap-3 pt-1">
            <button onClick={() => void handleEmitir()} disabled={loading}
              className={cn(
                'flex-1 py-2.5 rounded-lg font-medium text-sm text-white',
                'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
              )}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{pipelineStep === 'emitindo' ? 'Emitindo...' : pipelineStep === 'importando' ? 'Importando...' : pipelineStep === 'cpro' ? 'CPro...' : 'Processando...'}</>
              ) : (
                <><Send className="w-4 h-4" />Emitir Guia</>
              )}
            </button>
            {loading && (
              <button onClick={() => abortRef.current?.abort()}
                className="px-4 py-2.5 rounded-lg font-medium text-sm bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors">
                Cancelar
              </button>
            )}
          </div>
        </div>

        {/* Right panel: log */}
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <TerminalSquare className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Pipeline</span>
            {loading && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[#f0c040]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f0c040] animate-pulse" />
                {pipelineStep === 'emitindo' ? 'Emitindo SAW' : pipelineStep === 'importando' ? 'Importando' : pipelineStep === 'cpro' ? 'CPro' : 'Ao vivo'}
              </span>
            )}
            {pipelineStep === 'done' && (
              <span className="ml-auto flex items-center gap-1.5 text-xs text-[#4ade80]">
                <CheckCircle className="w-3.5 h-3.5" /> Concluido
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5"
            style={{ background: '#0a0a0a', minHeight: '400px', maxHeight: 'calc(100vh - 200px)', scrollbarWidth: 'thin', scrollbarColor: '#333 #0a0a0a' }}>
            {logs.length === 0 && !loading && <p className="text-[#444] select-none">Aguardando emissao da guia...</p>}
            {loading && logs.length === 0 && <p className="text-[#f0c040]">Conectando...</p>}
            {logs.map((log, i) => <LogLine key={i} log={log} />)}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}
