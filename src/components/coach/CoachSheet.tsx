import { useEffect, useRef, useState } from 'react'
import { isSameDay, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CoachMessage } from './CoachMessage.tsx'
import { CoachInput } from './CoachInput.tsx'
import { CoachMemoryCandidates } from './CoachMemoryCandidates.tsx'
import { useCoach } from '../../hooks/useCoach.ts'

interface Props {
  open: boolean
  onClose: () => void
  onOpenProfile?: () => void
}

function daySeparator(d: Date): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(d, today)) return 'hoje'
  if (isSameDay(d, yesterday)) return 'ontem'
  return format(d, "d 'de' MMM", { locale: ptBR })
}

export function CoachSheet({ open, onClose, onOpenProfile }: Props) {
  const {
    messages, candidates, sendMessage, triggerExtract,
    acceptCandidate, dismissCandidate, markRead,
  } = useCoach()
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      void markRead()
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    } else {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }
  }, [open, markRead])

  // Auto-scroll on new message
  useEffect(() => {
    if (!open || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, open])

  const handleSend = async (content: string) => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    setStreaming(true)
    await sendMessage(content, {
      onStart: () => { /* no-op: hook does optimistic insert */ },
      onDelta: () => { /* state update handled in hook */ },
      onDone: () => {
        setStreaming(false)
        idleTimerRef.current = setTimeout(() => {
          void triggerExtract()
        }, 30_000)
      },
      onError: () => {
        setStreaming(false)
      },
    })
  }

  if (!open) return null

  // Group by day for separators
  const grouped: Array<{ separator: string; entries: typeof messages }> = []
  for (const m of messages) {
    const d = new Date(m.createdAt)
    const sep = daySeparator(d)
    const last = grouped[grouped.length - 1]
    if (last && last.separator === sep) last.entries.push(m)
    else grouped.push({ separator: sep, entries: [m] })
  }

  // Identify streaming message: the last temp-coach entry while streaming is active
  const streamingTempId = streaming
    ? messages.filter(m => m.id.startsWith('temp-coach-')).slice(-1)[0]?.id ?? null
    : null

  return (
    <div
      role="dialog"
      aria-label="Coach"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          height: '92vh',
          background: 'var(--bg-elevated)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-light)',
        }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="fechar"
            style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
          >×</button>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '2px',
            color: 'var(--fg)',
            textTransform: 'uppercase',
          }}>coach</div>
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label="configurar coach"
            style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', padding: '4px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
            </svg>
          </button>
        </div>

        <CoachMemoryCandidates
          candidates={candidates}
          onAccept={acceptCandidate}
          onDismiss={dismissCandidate}
        />

        <div ref={scrollRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
        }}>
          {messages.length === 0 && (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--fg-dim)',
              fontSize: '13px',
            }}>
              fala aí. te ouço.
            </div>
          )}
          {grouped.map(g => (
            <div key={g.separator}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '2px',
                color: 'var(--fg-dim)',
                textTransform: 'uppercase',
                textAlign: 'center',
                margin: '16px 0 8px',
              }}>░ {g.separator} ░</div>
              {g.entries.map(m => (
                <CoachMessage
                  key={m.id}
                  entry={m}
                  streaming={m.id === streamingTempId}
                />
              ))}
            </div>
          ))}
        </div>

        <CoachInput onSend={(c) => { void handleSend(c) }} disabled={streaming} />
      </div>
    </div>
  )
}
