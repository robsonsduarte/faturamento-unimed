'use client'

import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react'

export interface LightboxPhoto {
  url: string
  label?: string
  downloadName?: string
}

interface Props {
  photos: LightboxPhoto[]
  index: number
  onClose: () => void
  onIndexChange: (i: number) => void
}

export function PhotoLightbox({ photos, index, onClose, onIndexChange }: Props) {
  const total = photos.length
  const current = photos[index]

  const prev = useCallback(() => {
    if (total < 2) return
    onIndexChange((index - 1 + total) % total)
  }, [index, total, onIndexChange])

  const next = useCallback(() => {
    if (total < 2) return
    onIndexChange((index + 1) % total)
  }, [index, total, onIndexChange])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 right-4 p-2 rounded-full text-white hover:bg-white/10 transition"
        title="Fechar (ESC)"
      >
        <X className="w-6 h-6" />
      </button>

      {current.downloadName && (
        <a
          href={current.url}
          download={current.downloadName}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 right-16 p-2 rounded-full text-white hover:bg-white/10 transition"
          title="Baixar"
        >
          <Download className="w-5 h-5" />
        </a>
      )}

      {total > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          className="absolute left-4 p-2 rounded-full text-white hover:bg-white/10 transition"
          title="Anterior (←)"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      <div
        className="max-w-[92vw] max-h-[92vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.label ?? ''}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        {(current.label || total > 1) && (
          <div className="flex items-center gap-3 text-sm text-white/80">
            {current.label && <span>{current.label}</span>}
            {total > 1 && (
              <span className="text-white/50">
                {index + 1} / {total}
              </span>
            )}
          </div>
        )}
      </div>

      {total > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          className="absolute right-4 p-2 rounded-full text-white hover:bg-white/10 transition"
          title="Proxima (→)"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
    </div>
  )
}
