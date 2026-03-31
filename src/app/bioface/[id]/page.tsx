'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuiaData {
  paciente: string
  guia_number: string
  profissional: string
  qtd: number
  valor_sessao: number | null
  carteira_masked: string
}

type Screen = 'loading' | 'error' | 'info' | 'camera' | 'success'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// ─── Camera logic (inline, sem dependencia de auth context) ──────────────────

const CANVAS_WIDTH = 565
const CANVAS_HEIGHT = 317
const JPEG_QUALITY = 0.85

async function captureFrameAsBase64(
  videoEl: HTMLVideoElement
): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = CANVAS_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context indisponivel')
  ctx.drawImage(videoEl, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BiofacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get('t') ?? ''

  const [screen, setScreen] = useState<Screen>('loading')
  const [guia, setGuia] = useState<GuiaData | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [lgpdChecked, setLgpdChecked] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const [capturing, setCapturing] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ── Fetch guia data on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !token) {
      setErrorMsg('Link invalido. Solicite um novo link.')
      setScreen('error')
      return
    }

    const controller = new AbortController()

    fetch(
      `/api/biometria/capturar-publico?guia_id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`,
      { signal: controller.signal }
    )
      .then(async (res) => {
        const data = await res.json() as { success?: boolean; error?: string } & Partial<GuiaData>
        if (!res.ok || !data.success) {
          throw new Error(data.error ?? 'Erro ao validar link')
        }
        setGuia({
          paciente: data.paciente ?? '',
          guia_number: data.guia_number ?? '',
          profissional: data.profissional ?? '',
          qtd: data.qtd ?? 0,
          valor_sessao: data.valor_sessao ?? null,
          carteira_masked: data.carteira_masked ?? '',
        })
        setScreen('info')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar dados')
        setScreen('error')
      })

    return () => controller.abort()
  }, [id, token])

  // ── Orientation detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'camera') return

    const mq = window.matchMedia('(orientation: portrait)')
    setIsPortrait(mq.matches)

    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [screen])

  // ── Camera start/stop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'camera' || isPortrait) return

    let active = true

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 1280, height: 720 }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(() => {
        setErrorMsg('Nao foi possivel acessar a camera. Verifique as permissoes.')
        setScreen('error')
      })

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [screen, isPortrait])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleIniciarCaptura() {
    setScreen('camera')
  }

  function handleCancelar() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setScreen('info')
  }

  async function handleCapturar() {
    if (!videoRef.current || capturing) return
    setCapturing(true)

    try {
      const photo_base64 = await captureFrameAsBase64(videoRef.current)

      const res = await fetch('/api/biometria/capturar-publico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guia_id: id, token, photo_base64 }),
      })

      const data = await res.json() as { success?: boolean; error?: string }

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Erro ao enviar foto')
      }

      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setScreen('success')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar foto')
      setScreen('error')
    } finally {
      setCapturing(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={styles.mutedText}>Validando link...</p>
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div style={styles.centered}>
        <div style={styles.errorIcon}>✕</div>
        <h2 style={styles.title}>Link invalido</h2>
        <p style={styles.mutedText}>{errorMsg}</p>
      </div>
    )
  }

  if (screen === 'success') {
    return (
      <div style={styles.centered}>
        <div style={styles.successIcon}>✓</div>
        <h2 style={styles.title}>Foto enviada com sucesso!</h2>
        <p style={styles.mutedText}>Voce pode fechar esta janela.</p>
      </div>
    )
  }

  if (screen === 'info' && guia) {
    return (
      <div style={styles.page}>
        {/* Header */}
        <header style={styles.header}>
          <span style={styles.headerLogo}>Clinica Dedicare</span>
          <span style={styles.headerTitle}>Biometria Facial</span>
        </header>

        {/* Guia card */}
        <div style={styles.card}>
          <div style={styles.cardRow}>
            <span style={styles.label}>Paciente</span>
            <span style={styles.value}>{guia.paciente}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.cardRow}>
            <span style={styles.label}>Guia</span>
            <span style={styles.value}>{guia.guia_number}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.cardRow}>
            <span style={styles.label}>Profissional</span>
            <span style={styles.value}>{guia.profissional || '—'}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.cardRow}>
            <span style={styles.label}>Procedimentos</span>
            <span style={styles.value}>{guia.qtd}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.cardRow}>
            <span style={styles.label}>Valor por sessao</span>
            <span style={styles.value}>{formatCurrency(guia.valor_sessao)}</span>
          </div>
          <div style={styles.divider} />
          <div style={styles.cardRow}>
            <span style={styles.label}>Carteira</span>
            <span style={{ ...styles.value, fontFamily: 'monospace' }}>
              {guia.carteira_masked}
            </span>
          </div>
        </div>

        {/* LGPD consent */}
        <label style={styles.lgpdLabel}>
          <input
            type="checkbox"
            checked={lgpdChecked}
            onChange={(e) => setLgpdChecked(e.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.lgpdText}>
            Autorizo a coleta da minha imagem facial para fins exclusivos de
            autenticacao biometrica junto a operadora Unimed, conforme a Lei
            Geral de Protecao de Dados (LGPD - Lei 13.709/2018).
          </span>
        </label>

        {/* CTA */}
        <button
          onClick={handleIniciarCaptura}
          disabled={!lgpdChecked}
          style={{
            ...styles.btn,
            ...(lgpdChecked ? styles.btnPrimary : styles.btnDisabled),
          }}
        >
          Iniciar Captura
        </button>
      </div>
    )
  }

  if (screen === 'camera') {
    return (
      <div style={styles.cameraPage}>
        {isPortrait ? (
          /* Portrait — pede rotacao */
          <div style={styles.centered}>
            <div style={styles.rotateIcon}>⟳</div>
            <p style={styles.rotateText}>Gire o celular para a posicao horizontal</p>
          </div>
        ) : (
          /* Landscape — camera ativa */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={styles.video}
            />

            {/* Oval face guide */}
            <div style={styles.ovalGuide} />

            {/* Controls */}
            <div style={styles.cameraControls}>
              <button
                onClick={handleCapturar}
                disabled={capturing}
                style={{
                  ...styles.btn,
                  ...(capturing ? styles.btnDisabled : styles.btnPrimary),
                  minWidth: 160,
                }}
              >
                {capturing ? 'Enviando...' : 'Capturar Foto'}
              </button>
              <button
                onClick={handleCancelar}
                style={styles.cancelLink}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return null
}

// ─── Inline styles (dark theme matching CSS variables) ────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    backgroundColor: '#020617',
    color: '#f8fafc',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    gap: '1rem',
    maxWidth: 480,
    margin: '0 auto',
  },
  centered: {
    minHeight: '100dvh',
    backgroundColor: '#020617',
    color: '#f8fafc',
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '2rem',
    textAlign: 'center',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    paddingTop: '1rem',
    paddingBottom: '0.5rem',
  },
  headerLogo: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  headerTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#10b981',
  },
  card: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '0.75rem',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  cardRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.625rem',
    paddingBottom: '0.625rem',
    gap: '0.5rem',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
  },
  label: {
    fontSize: '0.8125rem',
    color: '#94a3b8',
    flexShrink: 0,
  },
  value: {
    fontSize: '0.875rem',
    color: '#f8fafc',
    fontWeight: 500,
    textAlign: 'right',
  },
  lgpdLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    cursor: 'pointer',
    padding: '0.75rem',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
  },
  checkbox: {
    marginTop: '0.125rem',
    width: 18,
    height: 18,
    flexShrink: 0,
    accentColor: '#10b981',
    cursor: 'pointer',
  },
  lgpdText: {
    fontSize: '0.8125rem',
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '0.875rem 1rem',
    borderRadius: '0.5rem',
    border: 'none',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    textAlign: 'center',
  },
  btnPrimary: {
    backgroundColor: '#10b981',
    color: '#020617',
    cursor: 'pointer',
  },
  btnDisabled: {
    backgroundColor: '#334155',
    color: '#64748b',
    cursor: 'not-allowed',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#f8fafc',
    margin: 0,
  },
  mutedText: {
    fontSize: '0.9375rem',
    color: '#94a3b8',
    margin: 0,
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '3px solid #334155',
    borderTopColor: '#10b981',
    animation: 'spin 0.8s linear infinite',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    backgroundColor: '#14532d',
    border: '2px solid #22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    color: '#22c55e',
    lineHeight: 1,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    backgroundColor: '#450a0a',
    border: '2px solid #ef4444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    color: '#ef4444',
    lineHeight: 1,
  },
  // ── Camera screen ───────────────────────────────────────────────────────────
  cameraPage: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  video: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  ovalGuide: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '55vw',
    height: '78vh',
    maxWidth: 340,
    maxHeight: 280,
    border: '3px solid rgba(16, 185, 129, 0.85)',
    borderRadius: '50%',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
    pointerEvents: 'none',
  },
  cameraControls: {
    position: 'absolute',
    bottom: '1.5rem',
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0 2rem',
  },
  cancelLink: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '0.9375rem',
    cursor: 'pointer',
    padding: '0.25rem 1rem',
    textDecoration: 'underline',
  },
  rotateIcon: {
    fontSize: '4rem',
    color: '#10b981',
    lineHeight: 1,
  },
  rotateText: {
    fontSize: '1.125rem',
    color: '#f8fafc',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 1.5,
  },
}
