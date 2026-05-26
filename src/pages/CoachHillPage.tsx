import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { useHillCoach } from '../hooks/useHillCoach.ts'

export function CoachHillPage() {
  const navigate = useNavigate()
  const { messages, sending, sendMessage } = useHillCoach()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const submit = () => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    void sendMessage(text)
  }

  const actions = (
    <button className="btn btn-ghost" onClick={() => navigate('/hill')} style={{ fontSize: '11px' }}>← Compass</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Topbar title="Coach Hill" actions={actions} />

      <div className="content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '140px' }}>
        {messages.length === 0 && (
          <div className="hill-affirmation" style={{ borderLeftColor: 'var(--accent)' }}>
            <div className="hill-affirmation-dim">Coach Hill</div>
            <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--fg)' }}>
              Sou seu coach — um espelho exigente. Traga um travamento, uma decisão, ou onde você anda se enganando. Vou apontar o padrão, não te consolar.
            </div>
          </div>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '12px 14px',
              fontSize: '14px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              color: 'var(--fg)',
            }}
          >
            {m.content || (sending && m.role === 'coach' ? '…' : '')}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg)', borderTop: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'flex-end',
      }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          rows={1}
          placeholder="Fale com o coach…"
          style={{
            flex: 1, padding: '10px 12px', background: 'var(--bg-elevated)',
            border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--fg)',
            fontFamily: 'inherit', fontSize: '14px', resize: 'none', maxHeight: '120px',
          }}
        />
        <button className="btn btn-accent" onClick={submit} disabled={sending || !draft.trim()} style={{ justifyContent: 'center' }}>
          {sending ? '…' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
