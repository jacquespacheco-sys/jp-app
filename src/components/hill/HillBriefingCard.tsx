import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api.ts'
import type { Affirmation, HillNudge } from '../../types/domain.ts'
import { AFFIRMATION_DIMENSION_LABELS } from '../../types/domain.ts'
import type { AffirmationsListResponse, HillNudgesResponse } from '../../types/api.ts'

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

export function HillBriefingCard() {
  const navigate = useNavigate()
  const [affirmations, setAffirmations] = useState<Affirmation[] | null>(null)
  const [todayNudge, setTodayNudge] = useState<HillNudge | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [aff, nud] = await Promise.all([
          api.get<AffirmationsListResponse>('/api/hill-affirmations-list'),
          api.get<HillNudgesResponse>('/api/hill-nudges'),
        ])
        if (cancelled) return
        setAffirmations(aff.affirmations)
        const today = new Date().toDateString()
        setTodayNudge(nud.nudges.find(n => new Date(n.createdAt).toDateString() === today && !n.dismissed) ?? null)
      } catch {
        if (!cancelled) setAffirmations([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (affirmations === null) return null

  const todays = affirmations.length
    ? affirmations[dayOfYear(new Date()) % affirmations.length]
    : undefined

  return (
    <div className="content" style={{ paddingBottom: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <button className="hill-briefing-card" onClick={() => navigate('/hill')}>
        <span style={{ fontSize: '20px', lineHeight: 1 }}>☾</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: '6px' }}>
            Hill{todays ? ` · ${AFFIRMATION_DIMENSION_LABELS[todays.dimension]}` : ''}
          </span>
          {todays ? (
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '16px', lineHeight: 1.35, color: 'var(--fg)' }}>
              “{todays.text}”
            </span>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--fg-muted)' }}>
              Defina seu Chief Aim e programe suas afirmações
            </span>
          )}
        </span>
        <span style={{ color: 'var(--fg-dim)', fontSize: '18px' }}>→</span>
      </button>

      {todayNudge && (
        <button
          className="hill-briefing-card"
          onClick={() => navigate('/hill/nudges')}
          style={{ background: 'var(--fg)', color: 'var(--bg)' }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>✦</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.65, marginBottom: '6px' }}>
              Coach Hill
            </span>
            <span style={{ fontSize: '13px', lineHeight: 1.45 }}>
              {todayNudge.content.length > 150 ? `${todayNudge.content.slice(0, 150)}…` : todayNudge.content}
            </span>
          </span>
          <span style={{ fontSize: '18px', opacity: 0.65 }}>→</span>
        </button>
      )}
    </div>
  )
}
