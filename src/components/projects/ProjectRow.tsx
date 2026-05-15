import type { Project, Area } from '../../types/domain.ts'

interface Props {
  project: Project
  areas: Area[]
  isChild?: boolean
  onSelect: (project: Project) => void
}

// Cores legadas (default antigo do schema). Tratadas como "não definida"
// para derivar uma cor determinística por id — dá variedade sem migration.
const LEGACY_DEFAULTS = new Set(['#7dd3fc', '#CFE3E8'])
const PALETTE = ['#DFD0EC', '#F5D5DC', '#CFE3E8', '#F5E8C3', '#F5D5C3', '#C9DDC9', '#9B6B73', '#5C8159', '#A06C4C', '#5D8194']

function colorForProject(p: Project): string {
  if (p.color && !LEGACY_DEFAULTS.has(p.color)) return p.color
  let h = 0
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]!
}

export function ProjectRow({ project, areas, isChild, onSelect }: Props) {
  const area = areas.find(a => a.id === project.areaId)
  const accent = colorForProject(project)

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
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: accent, flexShrink: 0, display: 'inline-block' }} />
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
