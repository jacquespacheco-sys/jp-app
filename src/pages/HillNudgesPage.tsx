import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Topbar } from '../components/layout/Topbar.tsx'
import { api } from '../api.ts'
import type { HillNudge } from '../types/domain.ts'
import { NUDGE_CATEGORY_LABELS } from '../types/domain.ts'
import type { HillNudgesResponse } from '../types/api.ts'

const RATINGS: { value: number; label: string }[] = [
  { value: 1, label: 'Útil' },
  { value: 0, label: 'Neutro' },
  { value: -1, label: 'Não fez sentido' },
]

export function HillNudgesPage() {
  const navigate = useNavigate()
  const [nudges, setNudges] = useState<HillNudge[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api.get<HillNudgesResponse>('/api/hill-nudges')
        if (!cancelled) setNudges(res.nudges)
      } catch {
        if (!cancelled) setNudges([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const sendFeedback = async (id: string, rating: number) => {
    setNudges(prev => prev?.map(n => n.id === id ? { ...n, feedback: rating } : n) ?? prev)
    try {
      await api.post('/api/hill-nudge-feedback', { coachMessageId: id, rating })
    } catch { /* otimista; ignora */ }
  }

  const actions = (
    <button className="btn btn-ghost" onClick={() => navigate('/hill')} style={{ fontSize: '11px' }}>← Compass</button>
  )

  return (
    <div>
      <Topbar title="Nudges do coach" actions={actions} />
      <div className="content">
        {nudges === null && <div className="empty-state" style={{ paddingTop: '20vh' }}>Carregando…</div>}
        {nudges !== null && nudges.length === 0 && (
          <div className="empty-state" style={{ paddingTop: '20vh' }}>
            Nenhum nudge ainda. O coach age quando os dados pedem — não antes.
          </div>
        )}

        {(nudges ?? []).map(n => (
          <div key={n.id} className="hill-aim" style={{ marginBottom: '14px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <span className="hill-affirmation-dim" style={{ marginBottom: 0 }}>
                {n.category ? (NUDGE_CATEGORY_LABELS[n.category] ?? n.category) : 'Coach'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-dim)' }}>
                {format(parseISO(n.createdAt), "d MMM", { locale: ptBR })}
              </span>
            </div>

            <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--fg)', whiteSpace: 'pre-wrap' }}>{n.content}</div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              {RATINGS.map(r => (
                <button
                  key={r.value}
                  onClick={() => { void sendFeedback(n.id, r.value) }}
                  className={`chip chip-mono${n.feedback === r.value ? ' chip-active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  {r.label}
                </button>
              ))}
              <button
                className="btn btn-ghost"
                style={{ fontSize: '11px', marginLeft: 'auto' }}
                onClick={() => navigate('/hill/coach')}
              >
                Conversar →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
