import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { api } from '../api.ts'
import type { AqalDashboardResponse } from '../types/api.ts'
import { QUADRANT_COLORS, QUADRANT_LABELS } from '../types/domain.ts'
import type { Quadrant } from '../types/domain.ts'
import { ProjectsCard } from '../components/projects/ProjectsCard.tsx'
import { useProjects } from '../hooks/useProjects.ts'
import { useAreas } from '../hooks/useAreas.ts'

const QUADRANT_POSITION: Record<Quadrant, { row: 0 | 1; col: 0 | 1; corner: string }> = {
  I:   { row: 0, col: 0, corner: 'UL' },
  IT:  { row: 0, col: 1, corner: 'UR' },
  WE:  { row: 1, col: 0, corner: 'LL' },
  ITS: { row: 1, col: 1, corner: 'LR' },
}

function MandalaQuadrant({
  quadrant, completed, minutes, percent,
}: { quadrant: Quadrant; completed: number; minutes: number; percent: number }) {
  const pos = QUADRANT_POSITION[quadrant]
  const intensity = Math.min(0.15 + percent * 0.85, 1)
  return (
    <div
      style={{
        gridRow: pos.row + 1, gridColumn: pos.col + 1,
        background: QUADRANT_COLORS[quadrant],
        opacity: intensity,
        padding: '24px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: pos.col === 0 ? 'flex-start' : 'flex-end',
        justifyContent: pos.row === 0 ? 'flex-start' : 'flex-end',
        textAlign: pos.col === 0 ? 'left' : 'right',
        color: 'var(--fg)',
        minHeight: '160px',
        position: 'relative',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', opacity: 0.7 }}>
        {pos.corner} · {quadrant}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px', maxWidth: '120px' }}>
        {QUADRANT_LABELS[quadrant]}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>
        {completed}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1px', marginTop: '4px' }}>
        {minutes > 0 ? `${minutes}min` : 'tarefas/7d'}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<AqalDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const { projects } = useProjects()
  const { areas } = useAreas()

  useEffect(() => {
    let cancelled = false
    api.get<AqalDashboardResponse>('/api/dashboard-aqal')
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div>
        <Topbar title="Mandala" actions={<ThemeToggle />} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <Topbar title="Mandala" actions={<ThemeToggle />} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Erro ao carregar</div>
      </div>
    )
  }

  const total = data.totals.completedThisWeek
  const maxCount = Math.max(1, ...data.byQuadrant.map(q => q.completed))

  return (
    <div>
      <Topbar
        title="Mandala AQAL"
        actions={(
          <>
            <button className="btn btn-ghost" onClick={() => navigate('/config')} style={{ fontSize: '11px' }}>← Config</button>
            <ThemeToggle />
          </>
        )}
      />

      <div className="content">
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Últimos 7 dias
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: '10px', color: 'var(--fg-muted)' }}>tarefas</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>{Math.round(data.totals.minutesThisWeek / 60 * 10) / 10}h</div>
              <div style={{ fontSize: '10px', color: 'var(--fg-muted)' }}>estimadas</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>{data.totals.openTasks}</div>
              <div style={{ fontSize: '10px', color: 'var(--fg-muted)' }}>abertas</div>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px',
          background: 'var(--bg-subtle)',
          marginBottom: '32px',
        }}>
          {data.byQuadrant.map(q => (
            <MandalaQuadrant
              key={q.quadrant}
              quadrant={q.quadrant}
              completed={q.completed}
              minutes={q.minutes}
              percent={q.completed / maxCount}
            />
          ))}
        </div>

        <ProjectsCard projects={projects} areas={areas} />

        <div className="section">
          <div className="section-title">Por área</div>
          {data.byArea.length === 0 && (
            <div className="empty-state" style={{ padding: '12px 0', textAlign: 'left' }}>—</div>
          )}
          {data.byArea
            .sort((a, b) => (b.completed + b.open) - (a.completed + a.open))
            .map(a => (
              <div key={a.areaId} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: QUADRANT_COLORS[a.quadrant], flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: '13px' }}>{a.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '0.5px' }}>
                  {a.completed} ✓ · {a.open} ○
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
