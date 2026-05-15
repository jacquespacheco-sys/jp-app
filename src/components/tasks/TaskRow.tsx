import type { Task, Project, Quadrant } from '../../types/domain.ts'
import { QUADRANT_COLORS, QUADRANT_LABELS } from '../../types/domain.ts'
import { IconRepeat, EnergyDots } from '../common/Icon.tsx'
import { Chip } from '../common/Chip.tsx'

interface Props {
  task: Task
  projects: Project[]
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
  onSetQuadrant?: (task: Task, q: Quadrant | null) => void
}

const PRIORITY_DOT: Record<Task['priority'], string> = {
  high: 'task-priority-dot',
  med: 'task-priority-dot med',
  low: 'task-priority-dot low',
}

const QUADRANT_OPTS: Quadrant[] = ['I', 'IT', 'WE', 'ITS']

function tinted(color: string): React.CSSProperties {
  return { background: `${color}33`, borderColor: `${color}88`, color: 'var(--fg)' }
}

export function TaskRow({ task, projects, onOpen, onToggleDone, onSetQuadrant }: Props) {
  const project = projects.find(p => p.id === task.projectId)
  const isDone = task.status === 'done'
  const q = task.quadrantOverride ?? task.resolvedQuadrant

  const dueLabel = task.dueAt
    ? new Date(task.dueAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : task.dueDate

  return (
    <div
      className={`task-row${isDone ? ' done' : ''}`}
      onClick={() => onOpen(task)}
      style={q ? { borderLeft: `3px solid ${QUADRANT_COLORS[q]}` } : undefined}
    >
      <div
        className="task-check"
        role="checkbox"
        aria-checked={isDone}
        onClick={e => { e.stopPropagation(); onToggleDone(task) }}
      />
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {project && (
            <span className="task-project">
              <span className="task-project-dot" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {dueLabel && <span>{dueLabel}</span>}
          {task.context && <span>@{task.context}</span>}
          {task.energy && <span style={{ display: 'inline-flex', alignItems: 'center' }}><EnergyDots value={task.energy} size={3} /></span>}
          {task.timeEstimateMin && <span>{task.timeEstimateMin}m</span>}
          {task.rrule && <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconRepeat size={10} /></span>}
          {task.status === 'waiting' && <span>aguardando</span>}
          {task.tags.map(tag => (
            <span key={tag} className="task-tag">{tag}</span>
          ))}
          {onSetQuadrant && (
            <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex' }}>
              <Chip
                label={q ?? 'AQAL'}
                {...(q ? { style: tinted(QUADRANT_COLORS[q]) } : {})}
                popover={(close) => (
                  <div className="popover-list">
                    <button className="popover-item" onClick={() => { onSetQuadrant(task, null); close() }}>
                      sem quadrante
                    </button>
                    {QUADRANT_OPTS.map(opt => (
                      <button
                        key={opt}
                        className="popover-item"
                        onClick={() => { onSetQuadrant(task, opt); close() }}
                        style={{ borderLeft: `3px solid ${QUADRANT_COLORS[opt]}` }}
                      >
                        {opt} · {QUADRANT_LABELS[opt]}
                      </button>
                    ))}
                  </div>
                )}
              />
            </span>
          )}
        </div>
      </div>
      <div className={PRIORITY_DOT[task.priority]} />
    </div>
  )
}
