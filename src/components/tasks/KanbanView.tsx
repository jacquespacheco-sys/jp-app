import { useState, useEffect, memo } from 'react'
import {
  DndContext, type DragEndEvent,
  MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, pointerWithin,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Task, Project, Area, Quadrant, TaskContext, HorizonLvl } from '../../types/domain.ts'
import { QUADRANT_COLORS, QUADRANT_LABELS } from '../../types/domain.ts'
import { IconRepeat, EnergyDots } from '../common/Icon.tsx'

type Mode = 'quadrant' | 'status' | 'area' | 'horizon' | 'context'

interface Props {
  tasks: Task[]
  projects: Project[]
  areas: Area[]
  onOpen: (task: Task) => void
  onStatusChange: (taskId: string, status: Task['status']) => void
  onQuadrantChange?: (taskId: string, quadrant: Quadrant | null) => void
  onAreaChange?: (taskId: string, areaId: string | null) => void
}

const STATUS_COLUMNS: { key: Task['status']; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'next', label: 'Próximas' },
  { key: 'doing', label: 'Fazendo' },
  { key: 'scheduled', label: 'Agendadas' },
  { key: 'waiting', label: 'Aguardando' },
  { key: 'blocked', label: 'Bloqueadas' },
  { key: 'someday', label: 'Algum dia' },
  { key: 'done', label: 'Concluídas' },
  { key: 'cancelled', label: 'Canceladas' },
]

const QUADRANT_COLUMNS: { key: Quadrant; label: string }[] = [
  { key: 'I', label: QUADRANT_LABELS.I },
  { key: 'IT', label: QUADRANT_LABELS.IT },
  { key: 'WE', label: QUADRANT_LABELS.WE },
  { key: 'ITS', label: QUADRANT_LABELS.ITS },
]

const HORIZON_COLUMNS: { key: HorizonLvl; label: string }[] = [
  { key: 'H0', label: 'H0 · agora' },
  { key: 'H1', label: 'H1 · hoje' },
  { key: 'H2', label: 'H2 · áreas' },
  { key: 'H3', label: 'H3 · 1-2 anos' },
  { key: 'H4', label: 'H4 · 3-5 anos' },
  { key: 'H5', label: 'H5 · vida' },
]

const CONTEXT_COLUMNS: { key: TaskContext; label: string }[] = [
  { key: 'deep', label: '@deep' },
  { key: 'shallow', label: '@shallow' },
  { key: 'social', label: '@social' },
  { key: 'criativo', label: '@criativo' },
  { key: 'somatico', label: '@somático' },
  { key: 'offline', label: '@offline' },
]

interface CardProps { task: Task; project: Project | undefined; onOpen: (task: Task) => void }

const KanbanCard = memo(function KanbanCard({ task, project, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const q = task.resolvedQuadrant
  const showStatus = task.status !== 'next' && task.status !== 'inbox'

  const style: React.CSSProperties = {
    ...(q ? { borderLeft: `3px solid ${QUADRANT_COLORS[q]}` } : {}),
    ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
    ...(isDragging ? { opacity: 0.4, zIndex: 999, position: 'relative' as const } : {}),
    touchAction: 'none',
  }

  return (
    <div
      ref={setNodeRef}
      className={`kanban-card${isDragging ? ' dragging' : ''}`}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onOpen(task) }}
      style={style}
    >
      {project && <div className="kanban-card-project">{project.name}</div>}
      <div className="kanban-card-title">{task.title}</div>
      <div className="kanban-card-meta">
        {showStatus && <span>{task.status}</span>}
        {task.context && <span>@{task.context}</span>}
        {task.energy && <span style={{ display: 'inline-flex', alignItems: 'center' }}><EnergyDots value={task.energy} size={3} /></span>}
        {task.timeEstimateMin && <span>{task.timeEstimateMin}m</span>}
        {task.rrule && <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconRepeat size={10} /></span>}
      </div>
    </div>
  )
})

interface ColProps {
  id: string
  label: string
  tasks: Task[]
  projects: Project[]
  onOpen: (task: Task) => void
  accent?: string
  droppable: boolean
}

const KanbanColumn = memo(function KanbanColumn({ id, label, tasks, projects, onOpen, accent, droppable }: ColProps) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable })

  return (
    <div className="kanban-col">
      <div className="kanban-col-header">
        <span className="kanban-col-title" style={accent ? { color: accent } : undefined}>{label}</span>
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

const MODE_LABELS: Record<Mode, string> = {
  quadrant: 'Quadrante',
  status: 'Status',
  area: 'Área',
  horizon: 'Horizonte',
  context: 'Contexto',
}

export function KanbanView({ tasks, projects, areas, onOpen, onStatusChange, onQuadrantChange, onAreaChange }: Props) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('jp_kanban_mode') : null
    if (saved === 'quadrant' || saved === 'status' || saved === 'area' || saved === 'horizon' || saved === 'context') return saved
    return 'quadrant'
  })

  useEffect(() => {
    try { window.localStorage.setItem('jp_kanban_mode', mode) } catch { /* noop */ }
  }, [mode])

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const taskId = String(active.id)
    const overId = String(over.id)
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (mode === 'status') {
      const newStatus = overId as Task['status']
      if (task.status !== newStatus) onStatusChange(taskId, newStatus)
    } else if (mode === 'quadrant') {
      const newQuadrant = overId === 'none' ? null : (overId as Quadrant)
      onQuadrantChange?.(taskId, newQuadrant)
    } else if (mode === 'area') {
      const newAreaId = overId === 'none' ? null : overId
      onAreaChange?.(taskId, newAreaId)
    }
  }

  let columns: { id: string; label: string; tasks: Task[]; accent?: string }[] = []
  let droppable = mode === 'status' || mode === 'quadrant' || mode === 'area'

  if (mode === 'status') {
    columns = STATUS_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      tasks: tasks.filter(t => t.status === c.key),
    }))
  } else if (mode === 'quadrant') {
    columns = QUADRANT_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      accent: QUADRANT_COLORS[c.key],
      tasks: tasks.filter(t => t.resolvedQuadrant === c.key),
    }))
    const semQuad = tasks.filter(t => !t.resolvedQuadrant)
    if (semQuad.length > 0) columns.push({ id: 'none', label: 'sem quadrante', tasks: semQuad })
  } else if (mode === 'area') {
    columns = areas.map(a => ({
      id: a.id,
      label: a.name,
      accent: QUADRANT_COLORS[a.quadrant],
      tasks: tasks.filter(t => t.areaId === a.id),
    })).filter(c => c.tasks.length > 0)
    const semArea = tasks.filter(t => !t.areaId)
    if (semArea.length > 0) columns.push({ id: 'none', label: 'sem área', tasks: semArea })
  } else if (mode === 'horizon') {
    const projectHorizonMap = new Map<string, HorizonLvl>()
    for (const p of projects) {
      const ph = (p as Project & { horizon?: HorizonLvl }).horizon
      if (ph) projectHorizonMap.set(p.id, ph)
    }
    columns = HORIZON_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      tasks: tasks.filter(t => projectHorizonMap.get(t.projectId) === c.key),
    })).filter(c => c.tasks.length > 0)
    const semHorizon = tasks.filter(t => !projectHorizonMap.get(t.projectId))
    if (semHorizon.length > 0) columns.push({ id: 'none', label: 'sem horizonte', tasks: semHorizon })
  } else if (mode === 'context') {
    columns = CONTEXT_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      tasks: tasks.filter(t => t.context === c.key),
    })).filter(c => c.tasks.length > 0)
    const semCtx = tasks.filter(t => !t.context)
    if (semCtx.length > 0) columns.push({ id: 'none', label: 'sem contexto', tasks: semCtx })
  }

  const body = (
    <div className="kanban-wrapper">
      <div className="kanban-columns">
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            tasks={col.tasks}
            projects={projects}
            onOpen={onOpen}
            {...(col.accent ? { accent: col.accent } : {})}
            droppable={droppable}
          />
        ))}
        {columns.length === 0 && <div className="empty-state">Nenhuma tarefa</div>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="kanban-mode-bar">
        {(Object.keys(MODE_LABELS) as Mode[]).map(m => (
          <button
            key={m}
            className={`kanban-mode-btn${mode === m ? ' active' : ''}`}
            onClick={() => setMode(m)}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {droppable ? (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>{body}</DndContext>
      ) : body}
    </div>
  )
}
