'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown>
  guia_id: string | null
  read_at: string | null
  created_at: string
}

interface NotificationsBellProps {
  userId: string
}

const MAX_ITEMS = 20

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export function NotificationsBell({ userId }: NotificationsBellProps) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const unreadCount = items.filter((n) => !n.read_at).length

  // Fetch inicial + realtime subscription
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      // Garantir que realtime tem o JWT do usuario para respeitar RLS
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_ITEMS)
      if (active && data) setItems(data as NotificationRow[])

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const n = payload.new as NotificationRow
            setItems((prev) => {
              if (prev.some((p) => p.id === n.id)) return prev
              return [n, ...prev].slice(0, MAX_ITEMS)
            })
            toast.success(n.title, { description: n.body ?? undefined })
          }
        )
        .subscribe()
    })()

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markAsRead(id: string) {
    const supabase = createClient()
    const nowIso = new Date().toISOString()
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: nowIso } : n)))
    await supabase.from('notifications').update({ read_at: nowIso }).eq('id', id)
  }

  async function markAllAsRead() {
    const supabase = createClient()
    const nowIso = new Date().toISOString()
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: nowIso })))
    await supabase.from('notifications').update({ read_at: nowIso }).in('id', unreadIds)
  }

  function handleItemClick(n: NotificationRow) {
    if (!n.read_at) void markAsRead(n.id)
    setOpen(false)
    if (n.guia_id) router.push(`/dashboard/guias/${n.guia_id}`)
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-card)] transition-colors'
        )}
        aria-label="Notificacoes"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold text-white flex items-center justify-center"
            style={{ background: 'var(--color-danger)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-xl z-50 flex flex-col max-h-[70vh]"
          style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Notificacoes
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-xs hover:text-[var(--color-text)] transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <CheckCheck className="w-3 h-3" />
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Sem notificacoes
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b hover:bg-[var(--color-surface)] transition-colors',
                        !n.read_at && 'bg-[var(--color-surface)]/40'
                      )}
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read_at && (
                          <span
                            className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                            style={{ background: 'var(--color-primary)' }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {n.title}
                            </p>
                            <span
                              className="text-[10px] shrink-0"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {formatTime(n.created_at)}
                            </span>
                          </div>
                          {n.body && (
                            <p
                              className="text-xs mt-0.5 line-clamp-2"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {n.body}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
