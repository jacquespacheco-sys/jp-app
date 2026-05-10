import { useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { memo } from 'react'
import type { Task, Project } from '../../types/domain.ts'

interface Props {
  tasks: Task[]
  projects: Project[]
  onOpen: (task: Task) => void
  onStatusChange: (taskId: string, status: Task['status']) => void
}

const COLUMNS: { key: Task['status']; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'next', label: 'Próximas' },
  { key: 'doing', label: 'Fazendo' },
  { key: 'blocked', label: 'Bloqueado' },
  { key: 'done', label: 'Concluído' },
]

interface CardProps { task: Task; project: Project | undefined; onOpen: (task: Task) => void }

const KanbanCard = memo(function KanbanCard({ task, project, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      className={`kanban-card${isDragging ? ' dragging' : ''}`}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
    >
      {project && <div className="kanban-card-project">{project.name}</div>}
      <div className="kanban-card-title">{task.title}</div>
      <div className="kanban-card-meta">
        {task.dueDate && <span>{task.dueDate}</span>}
        {task.tags.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}
      </div>
    </div>
  )
})

interface ColProps { status: Task['status']; label: string; tasks: Task[]; projects: Project[]; onOpen: (task: Task) => void }

const KanbanColumn = memo(function KanbanColumn({ status, label, tasks, projects, onOpen }: ColProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="kanban-col">
      <div className="kanban-col-header">
        <span className="kanban-col-title">{label}</span>
        <span className="kanban-col-count">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className={`kanban-col-body${isOver ? ' drag-over' : ''}`}>
        {tasks.map(task => (
          <KanbanCard
            key={task.id}
            task={task}
            project={projects.find(p => p.id === task.projectId)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  )
})

// ---- Groups view (vertical list per status) ----

interface GroupRowProps { task: Task; project: Project | undefined; onOpen: (task: Task) => void }

function GroupRow({ task, project, onOpen }: GroupRowProps) {
  return (
    <div className="task-row" onClick={() => onOpen(task)} style={{ cursor: 'pointer' }}>
      <div className="task-check" style={task.status === 'done' ? undefined : { background: 'transparent' }} />
      <div className="task-main">
        <div className="task-title" style={task.status === 'done' ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>
          {task.title}
        </div>
        <div className="task-meta">
          {project && <span className="task-meta-project">{project.name}</span>}
          {task.dueDate && <span>{task.dueDate.slice(0, 10)}</span>}
          {task.tags.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}
        </div>
      </div>
    </div>
  )
}

function GroupsView({ tasks, projects, onOpen }: { tasks: Task[]; projects: Project[]; onOpen: (task: Task) => void }) {
  return (
    <div className="content">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key)
        if (colTasks.length === 0) return null
        return (
          <div key={col.key} style={{ marginBottom: '24px' }}>
            <div className="kanban-groups-header">
              <span className="kanban-col-title">{col.label}</span>
              <span className="kanban-col-count">{colTasks.length}</span>
            </div>
            <div>
              {colTasks.map(task => (
                <GroupRow
                  key={task.id}
                  task={task}
                  project={projects.find(p => p.id === task.projectId)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        )
      })}
      {tasks.length === 0 && <div className="empty-state">Nenhuma tarefa</div>}
    </div>
  )
}

// ---- Main export ----

export function KanbanView({ tasks, projects, onOpen, onStatusChange }: Props) {
  const [mode, setMode] = useState<'flow' | 'groups'>('flow')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const taskId = String(active.id)
    const newStatus = String(over.id) as Task['status']
    const task = tasks.find(t => t.id === taskId)
    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus)
    }
  }

  return (
    <div>
      <div className="kanban-mode-bar">
        <button
          className={`kanban-mode-btn${mode === 'flow' ? ' active' : ''}`}
          onClick={() => setMode('flow')}
        >
          Fluxo
        </button>
        <button
          className={`kanban-mode-btn${mode === 'groups' ? ' active' : ''}`}
          onClick={() => setMode('groups')}
        >
          Grupos
        </button>
      </div>

      {mode === 'groups' ? (
        <GroupsView tasks={tasks} projects={projects} onOpen={onOpen} />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="kanban-wrapper">
            <div className="kanban-columns">
              {COLUMNS.map(col => (
                <KanbanColumn
                  key={col.key}
                  status={col.key}
                  label={col.label}
                  tasks={tasks.filter(t => t.status === col.key)}
                  projects={projects}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        </DndContext>
      )}
    </div>
  )
}
