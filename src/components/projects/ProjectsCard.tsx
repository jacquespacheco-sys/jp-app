import { Link } from 'react-router-dom'
import type { Project, Area } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'

interface Props {
  projects: Project[]
  areas: Area[]
}

export function ProjectsCard({ projects, areas }: Props) {
  const top = projects
    .filter(p => p.status === 'active' && !p.parentId)
    .sort((a, b) => a.position - b.position)
    .slice(0, 5)

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <span className="dashboard-card-title">Projetos ativos</span>
        <Link to="/projects" className="dashboard-card-link">ver tudo →</Link>
      </div>
      {top.length === 0 ? (
        <div className="dashboard-card-empty">Nenhum projeto ativo</div>
      ) : (
        <div className="dashboard-card-list">
          {top.map(p => {
            const area = areas.find(a => a.id === p.areaId)
            const accent = p.resolvedQuadrant
              ? QUADRANT_COLORS[p.resolvedQuadrant]
              : (area ? QUADRANT_COLORS[area.quadrant] : '#9ca3af')
            const total = p.taskCount
            const done = total - p.taskOpenCount
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Link key={p.id} to="/projects" className="dashboard-card-row" style={{ borderLeft: `3px solid ${accent}` }}>
                <div className="dashboard-card-row-main">
                  <div className="dashboard-card-row-name">{p.title || p.name}</div>
                  <div className="dashboard-card-row-meta">
                    {area && <span>{area.name}</span>}
                    <span>{p.horizon}</span>
                    {p.kind === 'outcome' && total > 0 && <span>{pct}%</span>}
                    {p.kind === 'evergreen' && <span>evergreen</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
