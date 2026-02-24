'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'
import type { Prestador } from '@/lib/types'

interface PrestadorForm {
  nome: string
  codigo_prestador: string
  registro_ans: string
  cnes: string
  padrao_tiss: string
  cnpj: string
}

const DEFAULT_FORM: PrestadorForm = {
  nome: 'DEDICARE SERVICOS DE FONOAUDIOLOGIA PSICOLOGIA E NUTRICAO',
  codigo_prestador: '97498504',
  registro_ans: '339679',
  cnes: '9794220',
  padrao_tiss: '4.02.00',
  cnpj: '',
}

export default function PrestadorPage() {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<PrestadorForm>(DEFAULT_FORM)

  const { data: prestador } = useQuery({
    queryKey: ['prestador'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase.from('prestadores').select('*').limit(1).single()
      return data as Prestador | null
    },
  })

  useEffect(() => {
    if (prestador) {
      setForm({
        nome: prestador.nome,
        codigo_prestador: prestador.codigo_prestador,
        registro_ans: prestador.registro_ans,
        cnes: prestador.cnes,
        padrao_tiss: prestador.padrao_tiss,
        cnpj: prestador.cnpj ?? '',
      })
    }
  }, [prestador])

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      if (prestador) {
        const { error } = await supabase.from('prestadores').update(form).eq('id', prestador.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('prestadores').insert(form)
        if (error) throw error
      }
      toast.success('Dados do prestador salvos com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const fields: Array<{ key: keyof PrestadorForm; label: string }> = [
    { key: 'nome', label: 'Nome do Prestador' },
    { key: 'codigo_prestador', label: 'Codigo Prestador ANS' },
    { key: 'registro_ans', label: 'Registro ANS' },
    { key: 'cnes', label: 'CNES' },
    { key: 'padrao_tiss', label: 'Padrao TISS' },
    { key: 'cnpj', label: 'CNPJ' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dados do Prestador"
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

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 max-w-2xl space-y-4">
        {fields.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">{label}</label>
            <input
              value={form[key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]',
                'text-sm text-[var(--color-text)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
              )}
            />
          </div>
        ))}

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white',
              'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Dados
          </button>
        </div>
      </div>
    </div>
  )
}
