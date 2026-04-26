import type { Task, Project } from '../../types/domain.ts'
import { TaskRow } from './TaskRow.tsx'

interface Props {
  tasks: Task[]
  projects: Project[]
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
}

const today = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const PRIORITY_ORDER: Record<Task['priority'], number> = { high: 0, med: 1, low: 2 }

export function TodayView({ tasks, projects, onOpen, onToggleDone }: Props) {
  const todayStr = today()

  const active = tasks
    .filter(t => t.status !== 'done' && (
      t.status === 'doing' ||
      t.status === 'next' ||
      t.status === 'inbox' ||
      (t.dueDate !== undefined && t.dueDate <= todayStr)
    ))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  const done = tasks.filter(t => t.status === 'done' && t.dueDate === todayStr)

  return (
    <div className="content">
      <div className="task-group">
        <div className="task-group-title">
          Hoje
          <span className="task-group-count">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="empty-state">Nenhuma tarefa para hoje</div>
        ) : (
          active.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))
        )}
      </div>

      {done.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Concluído hoje
            <span className="task-group-count">{done.length}</span>
          </div>
          {done.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </div>
      )}
    </div>
  )
}
