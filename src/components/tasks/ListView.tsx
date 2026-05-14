import { useState } from 'react'
import type { Task, Project, Area } from '../../types/domain.ts'
import { TaskRow } from './TaskRow.tsx'
import { TaskFilterBar, applyTaskFilter, persistedTaskFilter, type TaskFilter } from './TaskFilterBar.tsx'

interface Props {
  tasks: Task[]
  projects: Project[]
  areas: Area[]
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
}

const PRIORITY_ORDER: Record<Task['priority'], number> = { high: 0, med: 1, low: 2 }
const FILTER_KEY = 'jp_list_filter'

export function ListView({ tasks, projects, areas, onOpen, onToggleDone }: Props) {
  const [filter, setFilter] = useState<TaskFilter>(persistedTaskFilter(FILTER_KEY))
  const filtered = applyTaskFilter(tasks, filter)
  const active = filtered.filter(t => t.status !== 'done')
  const done = filtered.filter(t => t.status === 'done')

  const grouped = projects
    .map(project => ({
      project,
      tasks: active
        .filter(t => t.projectId === project.id)
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    }))
    .filter(g => g.tasks.length > 0)

  const unassigned = active.filter(t => !projects.find(p => p.id === t.projectId))

  return (
    <div>
      <TaskFilterBar
        storageKey={FILTER_KEY}
        value={filter}
        onChange={setFilter}
        projects={projects}
        areas={areas}
        tasks={tasks}
      />
      <div className="content">
      {grouped.length === 0 && unassigned.length === 0 && done.length === 0 && (
        <div className="empty-state">Nenhuma tarefa</div>
      )}

      {grouped.map(({ project, tasks: pts }) => (
        <div key={project.id} className="task-group">
          <div className="task-group-title">
            {project.name}
            <span className="task-group-count">{pts.length}</span>
          </div>
          {pts.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </div>
      ))}

      {unassigned.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Sem projeto
            <span className="task-group-count">{unassigned.length}</span>
          </div>
          {unassigned.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Concluído
            <span className="task-group-count">{done.length}</span>
          </div>
          {done.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
