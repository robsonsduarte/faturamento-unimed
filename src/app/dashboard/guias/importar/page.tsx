'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'

export default function ImportarGuiasPage() {
  const [loading, setLoading] = useState(false)
  const [guideNumbers, setGuideNumbers] = useState('')
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const queryClient = useQueryClient()

  async function handleImportar() {
    setLoading(true)
    setResult(null)
    try {
      const numbers = guideNumbers
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)

      const response = await fetch('/api/guias/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guide_numbers: numbers.length > 0 ? numbers : undefined,
        }),
      })

      if (!response.ok) {
        const err = await response.json() as { error: string }
        throw new Error(err.error ?? 'Erro ao importar guias')
      }

      const data = await response.json() as { imported: number; errors: string[] }
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['guias'] })

      if (data.imported > 0) {
        toast.success(`${data.imported} guia(s) importada(s) com sucesso`)
      } else {
        toast.info('Nenhuma guia nova encontrada')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar Guias"
        description="Colete guias do portal SAW (Unimed)"
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
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Importar por numero de guia</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Informe um ou mais numeros de guia (um por linha) para importar do SAW. Deixe em branco para buscar todas as guias pendentes.
          </p>
          <textarea
            value={guideNumbers}
            onChange={(e) => setGuideNumbers(e.target.value)}
            placeholder="123456789&#10;987654321&#10;..."
            rows={6}
            className={cn(
              'w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
              'text-sm font-mono text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
              'resize-none'
            )}
          />
          <button
            onClick={handleImportar}
            disabled={loading}
            className={cn(
              'w-full py-2.5 rounded-lg font-medium text-sm text-white',
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
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">Resultado</h2>
          {!result && !loading && (
            <p className="text-sm text-[var(--color-text-muted)]">
              O resultado da importacao aparecera aqui.
            </p>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Coletando dados do SAW...
            </div>
          )}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--color-success)]/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-[var(--color-success)]">{result.imported}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">Guias importadas</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Processamento concluido</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-[var(--color-danger)]">Erros ({result.errors.length})</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-[var(--color-text-muted)] font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
