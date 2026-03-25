'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DuplicataItem {
  guide_number: string
  guide_number_prestador: string | null
  paciente: string | null
  lote_numero: string | null
  lote_id: string | null
  data_execucao: string
  codigo_procedimento: string
  nome_profissional: string
  descricao: string | null
}

interface DuplicataGroup {
  chave: string
  data_execucao: string
  nome_profissional: string
  codigo_procedimento: string
  descricao: string | null
  guias: DuplicataItem[]
}

export function ValidacaoDuplicatasModal() {
  const [duplicatas, setDuplicatas] = useState<DuplicataGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [minimized, setMinimized] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // Nao exibir na pagina de importacao (usuario pode estar corrigindo)
  const isImportPage = pathname === '/dashboard/guias/importar'

  const fetchDuplicatas = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/validacao/duplicatas', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) return

      const json = await res.json()
      setDuplicatas(json.duplicatas ?? [])
    } catch {
      // Silently fail — modal is informational
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDuplicatas()
    // Re-check every 2 minutes
    const interval = setInterval(fetchDuplicatas, 120_000)
    return () => clearInterval(interval)
  }, [fetchDuplicatas])

  // Nada para mostrar
  if (loading || duplicatas.length === 0 || isImportPage) return null

  // Guias unicas com problema
  const guiasUnicas = new Map<string, DuplicataItem>()
  for (const group of duplicatas) {
    for (const guia of group.guias) {
      guiasUnicas.set(guia.guide_number, guia)
    }
  }
  const guideNumbers = Array.from(guiasUnicas.keys())

  const handleImportar = () => {
    // Navega para importacao com as guias pre-preenchidas via query param
    const params = new URLSearchParams({ guias: guideNumbers.join(',') })
    router.push(`/dashboard/guias/importar?${params.toString()}`)
  }

  // Minimized: apenas badge flutuante
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg"
        style={{ background: 'var(--color-warning)', color: '#000' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="font-semibold text-sm">
          {duplicatas.length} duplicata{duplicatas.length > 1 ? 's' : ''}
        </span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-3xl rounded-xl border shadow-2xl"
        style={{
          background: 'var(--color-card)',
          borderColor: 'var(--color-warning)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-xl px-6 py-4"
          style={{ background: 'rgba(245, 158, 11, 0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--color-warning)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>
                Atendimentos Duplicados Detectados
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {duplicatas.length} conflito{duplicatas.length > 1 ? 's' : ''} encontrado{duplicatas.length > 1 ? 's' : ''} — {guideNumbers.length} guia{guideNumbers.length > 1 ? 's' : ''} afetada{guideNumbers.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="rounded-lg p-2 transition-colors hover:bg-white/10"
            title="Minimizar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto px-6 py-4">
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Os seguintes atendimentos foram cobrados com a <strong>mesma data</strong>,{' '}
            <strong>mesmo profissional</strong> e <strong>mesmo procedimento</strong> em guias diferentes.
            Corrija no sistema da Unimed e reimporte as guias.
          </p>

          <div className="space-y-3">
            {duplicatas.map((group) => (
              <div
                key={group.chave}
                className="rounded-lg border p-4"
                style={{
                  borderColor: 'var(--color-border)',
                  background: 'var(--color-surface)',
                }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className="rounded px-2 py-0.5 font-mono text-xs font-semibold"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-warning)' }}
                  >
                    {group.data_execucao}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                  <span style={{ color: 'var(--color-text)' }}>{group.nome_profissional}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                  <span className="font-mono text-xs" style={{ color: 'var(--color-secondary)' }}>
                    {group.codigo_procedimento}
                  </span>
                  {group.descricao && (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      — {group.descricao}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {group.guias.map((guia) => (
                    <div
                      key={guia.guide_number}
                      className="flex items-center justify-between rounded px-3 py-1.5 text-sm"
                      style={{ background: 'var(--color-card)' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>
                          {guia.guide_number}
                        </span>
                        {guia.paciente && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {guia.paciente.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      {guia.lote_numero && (
                        <span
                          className="rounded px-2 py-0.5 text-xs font-medium"
                          style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--color-secondary)' }}
                        >
                          Lote {guia.lote_numero}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between rounded-b-xl border-t px-6 py-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Corrija os atendimentos no SAW e reimporte as guias afetadas.
          </p>
          <button
            onClick={handleImportar}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--color-primary)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Reimportar {guideNumbers.length} guia{guideNumbers.length > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
