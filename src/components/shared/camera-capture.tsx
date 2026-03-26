'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface CameraCaptureProps {
  onCapture: (base64: string) => void
  onCancel: () => void
}

export function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('camera_unsupported')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 800 }, height: { ideal: 800 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraReady(true)
      }
    } catch (err) {
      const name = (err as DOMException)?.name ?? ''
      if (name === 'NotAllowedError') {
        setError('camera_denied')
      } else {
        setError('camera_error')
      }
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const size = Math.min(video.videoWidth, video.videoHeight, 800)
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Centralizar e cortar quadrado
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)

    const base64 = canvas.toDataURL('image/jpeg', 0.8)
    setPhoto(base64)
    stopCamera()
  }

  const retake = () => {
    setPhoto(null)
    startCamera()
  }

  const confirm = () => {
    if (photo) onCapture(photo)
  }

  // Fallback: input file
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const size = Math.min(img.width, img.height, 800)
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        setPhoto(base64)
        stopCamera()
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      {!photo && (
        <>
          {error ? (
            <div className="space-y-3">
              {error === 'camera_denied' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
                    Permissao de camera negada
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Clique no icone do cadeado na barra de endereco do navegador, permita o acesso a camera e recarregue a pagina. Ou use o botao abaixo para selecionar uma foto.
                  </p>
                </div>
              )}
              {error === 'camera_unsupported' && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Camera nao disponivel neste navegador. Use o botao abaixo para selecionar uma foto.
                </p>
              )}
              {error === 'camera_error' && (
                <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                  Erro ao acessar a camera. Use o botao abaixo para selecionar uma foto.
                </p>
              )}
              <div className="flex gap-2">
                <label
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileInput} />
                  Selecionar Foto
                </label>
                <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="relative mx-auto overflow-hidden rounded-xl border"
                style={{ borderColor: 'var(--color-border)', maxWidth: 400 }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Carregando camera...</p>
                  </div>
                )}
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={capture}
                  disabled={!cameraReady}
                  className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--color-primary)' }}
                >
                  Capturar
                </button>
                <button
                  onClick={onCancel}
                  className="rounded-lg border px-4 py-2.5 text-sm"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >
                  Cancelar
                </button>
              </div>
              <label
                className="flex cursor-pointer justify-center text-xs underline"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFileInput} />
                Ou selecionar arquivo
              </label>
            </div>
          )}
        </>
      )}

      {photo && (
        <div className="space-y-3">
          <div className="mx-auto overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-primary)', maxWidth: 400 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Foto capturada" className="w-full" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={confirm}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              Confirmar
            </button>
            <button
              onClick={retake}
              className="rounded-lg border px-4 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Refazer
            </button>
            <button
              onClick={onCancel}
              className="rounded-lg border px-4 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
