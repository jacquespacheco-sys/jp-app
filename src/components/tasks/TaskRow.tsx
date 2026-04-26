import type { Task, Project } from '../../types/domain.ts'

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

  return (
    <div className={`task-row${isDone ? ' done' : ''}`} onClick={() => onOpen(task)}>
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
          {task.dueDate && <span>{task.dueDate}</span>}
          {task.tags.map(tag => (
            <span key={tag} className="task-tag">{tag}</span>
          ))}
        </div>
      </div>
      <div className={PRIORITY_DOT[task.priority]} />
    </div>
  )
}
