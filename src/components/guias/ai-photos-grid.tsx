'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Download, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface AIPhoto {
  id: string
  background_name: string
  url: string
  selected: boolean
  created_at: string
}

interface Props {
  guiaId: string
}

export function AIPhotosGrid({ guiaId }: Props) {
  const [photos, setPhotos] = useState<AIPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const refetchRef = useRef<() => void>(() => {})

  async function fetchPhotos() {
    try {
      const r = await fetch(`/api/patient-photos?guiaId=${guiaId}`)
      if (!r.ok) return
      const data = await r.json() as { photos?: AIPhoto[] }
      setPhotos(data.photos ?? [])
    } finally {
      setLoading(false)
    }
  }
  refetchRef.current = fetchPhotos

  useEffect(() => {
    fetchPhotos()

    const supabase = createClient()
    const channel = supabase
      .channel(`patient_photos:${guiaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_photos',
          filter: `guia_id=eq.${guiaId}`,
        },
        () => refetchRef.current()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guiaId])

  async function handleSelect(id: string) {
    setSelecting(id)
    // Optimistic
    setPhotos((prev) => prev.map((p) => ({ ...p, selected: p.id === id })))
    try {
      const r = await fetch(`/api/patient-photos/${id}/select`, { method: 'POST' })
      if (!r.ok) throw new Error('fail')
      toast.success('Foto selecionada')
    } catch {
      toast.error('Erro ao selecionar')
      fetchPhotos()
    } finally {
      setSelecting(null)
    }
  }

  if (loading) return null
  if (photos.length === 0) return null

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      <div
        className="px-5 py-4 border-b flex items-center justify-between gap-4"
        style={{ borderColor: 'var(--color-border)', background: 'rgba(139, 92, 246, 0.06)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: '#a78bfa' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Fotos com fundo IA
          </h2>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            ({photos.length} variações)
          </span>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Clique pra selecionar a favorita
        </p>
      </div>

      <div className="p-5 grid grid-cols-5 gap-3">
        {photos.map((p) => (
          <div
            key={p.id}
            className={cn(
              'aspect-[3/4] rounded-lg border-2 overflow-hidden relative cursor-pointer transition-all group',
              p.selected
                ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
            )}
            style={{ background: 'var(--color-surface)' }}
            onClick={() => !p.selected && handleSelect(p.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.background_name} className="w-full h-full object-cover" />
            {p.selected && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(16, 185, 129, 0.25)' }}
              >
                <CheckCircle className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            )}
            {selecting === p.id && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              >
                <div className="animate-pulse text-white text-xs">Selecionando...</div>
              </div>
            )}
            <a
              href={p.url}
              download={`${p.background_name}.jpg`}
              onClick={(e) => e.stopPropagation()}
              title="Baixar"
              className="absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
            >
              <Download className="w-3 h-3" />
            </a>
            <span
              className="absolute bottom-1 left-1 right-1 text-[10px] text-white px-1.5 py-0.5 rounded truncate"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              title={p.background_name}
            >
              {p.background_name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
