import type { Task, Project } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'
import { IconRepeat, EnergyDots } from '../common/Icon.tsx'

interface Props {
  task: Task
  projects: Project[]
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
}

const PRIORITY_DOT: Record<Task['priority'], string> = {
  high: 'task-priority-dot',
  med: 'task-priority-dot med',
  low: 'task-priority-dot low',
}

export function TaskRow({ task, projects, onOpen, onToggleDone }: Props) {
  const project = projects.find(p => p.id === task.projectId)
  const isDone = task.status === 'done'
  const q = task.resolvedQuadrant

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
          {project && <span className="task-project">{project.name}</span>}
          {dueLabel && <span>{dueLabel}</span>}
          {task.context && <span>@{task.context}</span>}
          {task.energy && <span style={{ display: 'inline-flex', alignItems: 'center' }}><EnergyDots value={task.energy} size={3} /></span>}
          {task.timeEstimateMin && <span>{task.timeEstimateMin}m</span>}
          {task.rrule && <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconRepeat size={10} /></span>}
          {task.status === 'waiting' && <span>aguardando</span>}
          {task.tags.map(tag => (
            <span key={tag} className="task-tag">{tag}</span>
          ))}
        </div>
      </div>
      <div className={PRIORITY_DOT[task.priority]} />
    </div>
  )
}
