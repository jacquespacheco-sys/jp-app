import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { api } from '../api.ts'
import type { HillPreferences, HillCoachVoice } from '../types/domain.ts'
import { COACH_VOICE_LABELS } from '../types/domain.ts'
import type { HillPreferencesResponse } from '../types/api.ts'
import type { HillPreferencesInput } from '../../api/_schemas/hill.ts'

const VOICES: HillCoachVoice[] = ['strict', 'mixed', 'gentle']

export function HillPreferencesPage() {
  const navigate = useNavigate()
  const [prefs, setPrefs] = useState<HillPreferences | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api.get<HillPreferencesResponse>('/api/hill-preferences')
        if (!cancelled) setPrefs(res.preferences)
      } catch { /* mantém null */ }
    })()
    return () => { cancelled = true }
  }, [])

  const update = async (patch: HillPreferencesInput) => {
    setSaving(true)
    try {
      const res = await api.patch<HillPreferencesResponse>('/api/hill-preferences', patch)
      setPrefs(res.preferences)
    } finally {
      setSaving(false)
    }
  }

  const actions = (
    <button className="btn btn-ghost" onClick={() => navigate('/hill')} style={{ fontSize: '11px' }}>← Compass</button>
  )

  return (
    <div>
      <Topbar title="Preferências Hill" actions={actions} />
      <div className="content">
        {!prefs ? (
          <div className="empty-state" style={{ paddingTop: '20vh' }}>Carregando…</div>
        ) : (
          <>
            <div className="section">
              <div className="section-title">Voz do coach</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {VOICES.map(v => (
                  <button
                    key={v}
                    onClick={() => { void update({ coachVoice: v }) }}
                    disabled={saving}
                    className={`hill-affirmation${prefs.coachVoice === v ? '' : ''}`}
                    style={{
                      textAlign: 'left', cursor: 'pointer',
                      borderLeftColor: prefs.coachVoice === v ? 'var(--accent)' : 'var(--border)',
                      background: prefs.coachVoice === v ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--fg)' }}>{COACH_VOICE_LABELS[v]}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="section">
              <div className="section-title">Acompanhamento</div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '14px' }}>Murmurs do coach nos rituais</span>
                <input type="checkbox" checked={prefs.ritualMurmursEnabled} disabled={saving}
                  onChange={e => { void update({ ritualMurmursEnabled: e.target.checked }) }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
                <span style={{ fontSize: '14px' }}>Nudges diários (quando disponível)</span>
                <input type="checkbox" checked={prefs.dailyNudgeEnabled} disabled={saving}
                  onChange={e => { void update({ dailyNudgeEnabled: e.target.checked }) }} />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
