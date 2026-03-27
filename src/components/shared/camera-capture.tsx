'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// TRIX BioFace dimensions
const CAPTURE_WIDTH = 565
const CAPTURE_HEIGHT = 317

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
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
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

    // Output: TRIX dimensions (565x317)
    canvas.width = CAPTURE_WIDTH
    canvas.height = CAPTURE_HEIGHT

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Crop center of video to 16:9 aspect ratio
    const videoAspect = video.videoWidth / video.videoHeight
    const targetAspect = CAPTURE_WIDTH / CAPTURE_HEIGHT

    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight
    if (videoAspect > targetAspect) {
      sw = video.videoHeight * targetAspect
      sx = (video.videoWidth - sw) / 2
    } else {
      sh = video.videoWidth / targetAspect
      sy = (video.videoHeight - sh) / 2
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)

    const base64 = canvas.toDataURL('image/jpeg', 0.85)
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = CAPTURE_WIDTH
        canvas.height = CAPTURE_HEIGHT
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const imgAspect = img.width / img.height
        const targetAspect = CAPTURE_WIDTH / CAPTURE_HEIGHT
        let sx = 0, sy = 0, sw = img.width, sh = img.height
        if (imgAspect > targetAspect) {
          sw = img.height * targetAspect
          sx = (img.width - sw) / 2
        } else {
          sh = img.width / targetAspect
          sy = (img.height - sh) / 2
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)
        const base64 = canvas.toDataURL('image/jpeg', 0.85)
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
                    Clique no icone do cadeado na barra de endereco, permita a camera e recarregue a pagina.
                  </p>
                </div>
              )}
              {error === 'camera_unsupported' && (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Camera nao disponivel. Use o botao abaixo para selecionar uma foto.
                </p>
              )}
              {error === 'camera_error' && (
                <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
                  Erro ao acessar a camera. Use o botao abaixo.
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
              {/* Video container com moldura oval */}
              <div
                className="relative mx-auto overflow-hidden rounded-xl"
                style={{ maxWidth: 560, aspectRatio: '565/317', background: '#000' }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* Moldura busto (cabeca + ombros) como no TRIX */}
                {cameraReady && (
                  <div className="absolute inset-0 pointer-events-none">
                    <svg width="100%" height="100%" viewBox="0 0 565 317" preserveAspectRatio="xMidYMid slice">
                      <defs>
                        {/* Silhueta de busto: cabeca oval + ombros */}
                        <clipPath id="bust-clip">
                          {/* Cabeca */}
                          <ellipse cx="282" cy="105" rx="65" ry="80" />
                          {/* Pescoco */}
                          <rect x="262" y="175" width="40" height="30" rx="5" />
                          {/* Ombros */}
                          <path d="M 282 200 Q 282 210, 220 230 Q 160 250, 130 280 L 130 320 L 434 320 L 434 280 Q 404 250, 344 230 Q 282 210, 282 200 Z" />
                        </clipPath>
                        <mask id="bust-mask">
                          <rect width="565" height="317" fill="white" />
                          {/* Cabeca */}
                          <ellipse cx="282" cy="105" rx="65" ry="80" fill="black" />
                          {/* Pescoco */}
                          <rect x="262" y="175" width="40" height="30" rx="5" fill="black" />
                          {/* Ombros */}
                          <path d="M 282 200 Q 282 210, 220 230 Q 160 250, 130 280 L 130 320 L 434 320 L 434 280 Q 404 250, 344 230 Q 282 210, 282 200 Z" fill="black" />
                        </mask>
                      </defs>
                      {/* Overlay escuro fora da silhueta */}
                      <rect width="565" height="317" fill="rgba(0,0,0,0.25)" mask="url(#bust-mask)" />
                      {/* Contorno da silhueta */}
                      <ellipse cx="282" cy="105" rx="65" ry="80" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
                      <rect x="262" y="175" width="40" height="30" rx="5" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                      <path d="M 282 200 Q 282 210, 220 230 Q 160 250, 130 280 L 130 317 M 282 200 Q 282 210, 344 230 Q 404 250, 434 280 L 434 317" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
                    </svg>
                    <div className="absolute bottom-3 left-0 right-0 text-center">
                      <span className="rounded-full px-3 py-1 text-xs font-medium text-white/80" style={{ background: 'rgba(0,0,0,0.5)' }}>
                        Posicione o rosto dentro da moldura
                      </span>
                    </div>
                  </div>
                )}

                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--color-surface)' }}>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Carregando camera...</p>
                  </div>
                )}
              </div>

              {/* Botoes */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={capture}
                  disabled={!cameraReady}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--color-primary)' }}
                >
                  Capturar Foto
                </button>
                <button
                  onClick={onCancel}
                  className="rounded-full border px-5 py-2.5 text-sm"
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
          <div
            className="mx-auto overflow-hidden rounded-xl border"
            style={{ borderColor: 'var(--color-primary)', maxWidth: 560, aspectRatio: '565/317' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Foto capturada" className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={confirm}
              className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              Confirmar
            </button>
            <button
              onClick={retake}
              className="rounded-full border px-5 py-2.5 text-sm"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Refazer
            </button>
            <button
              onClick={onCancel}
              className="rounded-full border px-5 py-2.5 text-sm"
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
