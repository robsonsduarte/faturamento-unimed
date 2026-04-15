'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Download, Sparkles, Star, UserPlus, Trash2, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PhotoLightbox } from '@/components/shared/photo-lightbox'

interface AIPhoto {
  id: string
  background_name: string
  url: string
  selected: boolean
  created_at: string
}

interface Props {
  guiaId: string
  numeroCarteira?: string | null
  patientSlotsUsed?: number[]
  onPromoted?: (sequence: number) => void
}

export function AIPhotosGrid({ guiaId, patientSlotsUsed = [], onPromoted }: Props) {
  const [photos, setPhotos] = useState<AIPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [promoteFor, setPromoteFor] = useState<AIPhoto | null>(null)
  const [promoteTargetSeq, setPromoteTargetSeq] = useState<number | null>(null)
  const [promoting, setPromoting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AIPhoto | null>(null)
  const [deleting, setDeleting] = useState(false)
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
      toast.success('Foto favorita atualizada')
    } catch {
      toast.error('Erro ao selecionar')
      fetchPhotos()
    } finally {
      setSelecting(null)
    }
  }

  async function handlePromote() {
    if (!promoteFor || !promoteTargetSeq) return
    setPromoting(true)
    try {
      const r = await fetch(`/api/patient-photos/${promoteFor.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequence: promoteTargetSeq }),
      })
      const data = await r.json() as { error?: string; sequence?: number }
      if (!r.ok) throw new Error(data.error ?? 'Erro')
      toast.success(`Foto promovida para o slot ${promoteTargetSeq}`)
      onPromoted?.(promoteTargetSeq)
      setPromoteFor(null)
      setPromoteTargetSeq(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao promover')
    } finally {
      setPromoting(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/patient-photos/${confirmDelete.id}`, { method: 'DELETE' })
      if (!r.ok) {
        const data = await r.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Erro')
      }
      toast.success('Foto IA excluida')
      setPhotos((prev) => prev.filter((p) => p.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return null
  if (photos.length === 0) return null

  const lightboxPhotos = photos.map((p) => ({
    url: p.url,
    label: p.background_name,
    downloadName: `${p.background_name}.jpg`,
  }))

  return (
    <>
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
            Clique para ampliar · estrela = favorita · + = usar como foto do paciente
          </p>
        </div>

        <div className="p-5 grid grid-cols-5 gap-3">
          {photos.map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                'aspect-[3/4] rounded-lg border-2 overflow-hidden relative cursor-pointer transition-all group',
                p.selected
                  ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
              )}
              style={{ background: 'var(--color-surface)' }}
              onClick={() => setLightboxIndex(idx)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.background_name} className="w-full h-full object-cover" />

              {p.selected && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ background: 'rgba(16, 185, 129, 0.18)' }}
                >
                  <CheckCircle className="w-8 h-8 text-white drop-shadow-lg" />
                </div>
              )}

              {selecting === p.id && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)' }}
                >
                  <div className="animate-pulse text-white text-xs">Salvando...</div>
                </div>
              )}

              {/* Action toolbar (hover) */}
              <div
                className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx) }}
                  title="Ampliar"
                  className="p-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); if (!p.selected) handleSelect(p.id) }}
                  title={p.selected ? 'Favorita' : 'Marcar como favorita'}
                  className="p-1 rounded"
                  style={{
                    background: p.selected ? 'rgba(245, 158, 11, 0.85)' : 'rgba(0,0,0,0.55)',
                    color: 'white',
                  }}
                >
                  <Star className={cn('w-3 h-3', p.selected && 'fill-white')} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPromoteFor(p); setPromoteTargetSeq(null) }}
                  title="Usar como foto do paciente"
                  className="p-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
                >
                  <UserPlus className="w-3 h-3" />
                </button>
                <a
                  href={p.url}
                  download={`${p.background_name}.jpg`}
                  onClick={(e) => e.stopPropagation()}
                  title="Baixar"
                  className="p-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
                >
                  <Download className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(p) }}
                  title="Excluir foto IA"
                  className="p-1 rounded"
                  style={{ background: 'rgba(220, 38, 38, 0.85)', color: 'white' }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <span
                className="absolute bottom-1 left-1 right-1 text-[10px] text-white px-1.5 py-0.5 rounded truncate pointer-events-none"
                style={{ background: 'rgba(0,0,0,0.55)' }}
                title={p.background_name}
              >
                {p.background_name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={(i) => setLightboxIndex(i)}
        />
      )}

      {/* Promote modal — escolher slot 1..5 */}
      {promoteFor && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => !promoting && setPromoteFor(null)}
        >
          <div
            className="rounded-xl border p-5 w-full max-w-md"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
              Usar como foto do paciente
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Escolha qual slot (1-5) receberá esta variação IA. Slot ocupado será substituído.
            </p>

            <div className="grid grid-cols-5 gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((seq) => {
                const used = patientSlotsUsed.includes(seq)
                const isTarget = promoteTargetSeq === seq
                return (
                  <button
                    key={seq}
                    type="button"
                    onClick={() => setPromoteTargetSeq(seq)}
                    disabled={promoting}
                    className={cn(
                      'aspect-square rounded-lg border-2 flex flex-col items-center justify-center text-xs font-semibold transition-all',
                      isTarget
                        ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                    )}
                    style={{
                      background: used ? 'rgba(245, 158, 11, 0.12)' : 'var(--color-surface)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <span>{seq}</span>
                    <span className="text-[10px] font-normal" style={{ color: 'var(--color-text-muted)' }}>
                      {used ? 'ocupado' : 'livre'}
                    </span>
                  </button>
                )
              })}
            </div>

            {promoteTargetSeq && patientSlotsUsed.includes(promoteTargetSeq) && (
              <p className="text-xs mb-3" style={{ color: 'var(--color-warning, #f59e0b)' }}>
                ⚠ Slot {promoteTargetSeq} já tem foto — será substituída.
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPromoteFor(null)}
                disabled={promoting}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePromote}
                disabled={promoting || !promoteTargetSeq}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {promoting ? 'Promovendo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete IA */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => !deleting && setConfirmDelete(null)}
        >
          <div
            className="rounded-xl border p-5 w-full max-w-md"
            style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              Excluir foto IA
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Remover a variação “{confirmDelete.background_name}”? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--color-danger, #dc2626)' }}
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
