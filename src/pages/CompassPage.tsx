import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { AffirmationCard } from '../components/hill/AffirmationCard.tsx'
import { ChiefAimEditor } from '../components/hill/ChiefAimEditor.tsx'
import { useHill } from '../hooks/useHill.ts'

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export function CompassPage() {
  const navigate = useNavigate()
  const { chiefAim, affirmations, ritualStats, loading, saveChiefAim, updateChiefAimMeta } = useHill()
  const [editingAim, setEditingAim] = useState(false)

  const actions = (
    <>
      <button className="btn btn-ghost" onClick={() => navigate('/briefing')} style={{ fontSize: '11px' }}>← Briefing</button>
      <button className="btn btn-ghost" onClick={() => navigate('/hill/preferences')} style={{ fontSize: '11px' }} title="Preferências Hill">⚙</button>
      <ThemeToggle />
    </>
  )

  if (loading) {
    return (
      <div>
        <Topbar title="Compass" actions={actions} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div>
      </div>
    )
  }

  const remaining = chiefAim ? daysUntil(chiefAim.deadline) : 0

  return (
    <div>
      <Topbar title="Compass" actions={actions} />

      <div className="content">
        {/* ---------- Chief Aim ---------- */}
        <div className="section">
          <div className="section-title">Chief Aim</div>

          {editingAim || !chiefAim ? (
            <ChiefAimEditor
              {...(chiefAim ? { existing: chiefAim } : {})}
              onCreate={async input => { await saveChiefAim(input); setEditingAim(false) }}
              onUpdateMeta={async input => { await updateChiefAimMeta(input); setEditingAim(false) }}
              onCancel={() => setEditingAim(false)}
            />
          ) : (
            <div className="hill-aim">
              <div className="hill-aim-text">{chiefAim.aimText}</div>

              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '16px' }}>
                <span className="hill-aim-meta">
                  {remaining >= 0 ? `${remaining} dias restantes` : `prazo vencido há ${-remaining} dias`}
                </span>
                <span className="hill-aim-meta">prazo {chiefAim.deadline}</span>
              </div>

              <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <div className="hill-aim-meta" style={{ marginBottom: '6px' }}>Em troca</div>
                <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--fg)' }}>{chiefAim.exchangeText}</div>
              </div>

              {chiefAim.planText && (
                <div style={{ marginTop: '16px' }}>
                  <div className="hill-aim-meta" style={{ marginBottom: '6px' }}>Plano</div>
                  <div style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--fg-muted)', whiteSpace: 'pre-wrap' }}>{chiefAim.planText}</div>
                </div>
              )}

              <div style={{ marginTop: '18px', display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost" onClick={() => setEditingAim(true)} style={{ fontSize: '11px' }}>Editar plano / troca</button>
              </div>
            </div>
          )}
        </div>

        {/* ---------- Rituais ---------- */}
        <div className="section">
          <div className="section-title">Rituais</div>

          {ritualStats && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
              <div className="hill-stat">
                <div className="hill-stat-value">{ritualStats.morning.streak}</div>
                <div className="hill-stat-label">streak manhã</div>
              </div>
              <div className="hill-stat">
                <div className="hill-stat-value">{ritualStats.night.streak}</div>
                <div className="hill-stat-label">streak noite</div>
              </div>
              <div className="hill-stat">
                <div className="hill-stat-value">{ritualStats.morning.adherencePct}%</div>
                <div className="hill-stat-label">aderência 30d</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/hill/ritual/morning')}>
              ☀ Ritual da manhã
            </button>
            <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/hill/ritual/night')}>
              ☾ Ritual da noite
            </button>
          </div>
        </div>

        {/* ---------- Coach ---------- */}
        <div className="section">
          <div className="section-title">Coach</div>
          <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/hill/coach')}>
            ✦ Falar com o Coach Hill
          </button>
        </div>

        {/* ---------- Afirmações ---------- */}
        <div className="section">
          <div className="section-title">
            Afirmações
            <span className="count">{affirmations.length}/5</span>
          </div>

          {affirmations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {affirmations.map(a => <AffirmationCard key={a.id} affirmation={a} />)}
              <button className="btn btn-ghost" onClick={() => navigate('/hill/wizard')} style={{ fontSize: '11px', alignSelf: 'flex-start' }}>
                Refazer afirmações
              </button>
            </div>
          ) : chiefAim ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
              <div className="empty-state" style={{ padding: '8px 0', textAlign: 'left', fontSize: '13px' }}>
                Programe sua mente com 5 afirmações, uma por dimensão.
              </div>
              <button className="btn btn-accent" onClick={() => navigate('/hill/wizard')}>Criar minhas 5 afirmações</button>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '8px 0', textAlign: 'left', fontSize: '13px' }}>
              Defina seu Chief Aim primeiro — as afirmações nascem dele.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
