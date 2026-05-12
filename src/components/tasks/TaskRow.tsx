import type { Task, Project } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'

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

  const meta: string[] = []
  if (task.dueAt) meta.push(new Date(task.dueAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  else if (task.dueDate) meta.push(task.dueDate)
  if (task.context) meta.push(`@${task.context}`)
  if (task.energy) meta.push('⚡'.repeat(task.energy))
  if (task.timeEstimateMin) meta.push(`${task.timeEstimateMin}m`)
  if (task.rrule) meta.push('🔄')
  if (task.status === 'waiting') meta.push('aguardando')

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
          {meta.map((m, i) => <span key={i}>{m}</span>)}
          {task.tags.map(tag => (
            <span key={tag} className="task-tag">{tag}</span>
          ))}
        </div>
      </div>
      <div className={PRIORITY_DOT[task.priority]} />
    </div>
  )
}
