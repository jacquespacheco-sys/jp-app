import type { Project, Area } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'

interface Props {
  project: Project
  areas: Area[]
  isChild?: boolean
  onSelect: (project: Project) => void
}

export function ProjectRow({ project, areas, isChild, onSelect }: Props) {
  const area = areas.find(a => a.id === project.areaId)
  const accent = project.resolvedQuadrant
    ? QUADRANT_COLORS[project.resolvedQuadrant]
    : (area ? QUADRANT_COLORS[area.quadrant] : '#9ca3af')

  const total = project.taskCount
  const open = project.taskOpenCount
  const done = total - open
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const isOutcome = project.kind === 'outcome'

  return (
    <div
      className={`project-row${isChild ? ' is-child' : ''}`}
      onClick={() => onSelect(project)}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="project-row-main">
        <div className="project-row-header">
          <span className="project-row-name">{project.title || project.name}</span>
          {!isOutcome && <span className="project-row-badge">evergreen</span>}
        </div>
        {project.outcome && (
          <div className="project-row-outcome">{project.outcome}</div>
        )}
        <div className="project-row-meta">
          {area && <span>{area.name}</span>}
          <span>{project.horizon}</span>
          {isOutcome && <span>{done}/{total} tasks</span>}
          {!isOutcome && <span>{open} abertas</span>}
          {project.targetDate && <span>due {project.targetDate}</span>}
          {project.childCount > 0 && <span>{project.childCount} sub</span>}
        </div>
      </div>
      {isOutcome && total > 0 && (
        <div className="project-row-progress">
          <div className="project-progress-bar"><div className="project-progress-fill" style={{ width: `${pct}%` }} /></div>
          <span className="project-progress-pct">{pct}%</span>
        </div>
      )}
    </div>
  )
}
