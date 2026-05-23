import { useState, useEffect } from 'react'
import {
  DndContext, DragOverlay, type DragEndEvent, type DragStartEvent,
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
  onContextChange?: (taskId: string, context: TaskContext | null) => void
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
  { key: 'H0', label: 'H0 · hoje/atrasado' },
  { key: 'H1', label: 'H1 · esta semana' },
  { key: 'H2', label: 'H2 · trimestre' },
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

function whenLabel(task: Task): string | null {
  const sched = task.scheduledAt ? new Date(task.scheduledAt) : null
  if (sched && !isNaN(sched.getTime())) {
    return '◷ ' + sched.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
  if (task.dueAt) {
    const d = new Date(task.dueAt)
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    }
  }
  if (task.dueDate) {
    const [y, m, dd] = task.dueDate.slice(0, 10).split('-')
    if (y && m && dd) return `${dd}/${m}`
  }
  return null
}

function CardContent({ task, project, overlay }: { task: Task; project: Project | undefined; overlay?: boolean }) {
  const q = task.quadrantOverride ?? task.resolvedQuadrant
  const showStatus = task.status !== 'next' && task.status !== 'inbox'
  const when = whenLabel(task)
  return (
    <div
      className={`kanban-card${overlay ? ' dragging' : ''}`}
      style={{
        ...(q ? { borderLeft: `3px solid ${QUADRANT_COLORS[q]}` } : {}),
        ...(overlay ? { cursor: 'grabbing', boxShadow: 'var(--shadow)' } : {}),
      }}
    >
      {project && <div className="kanban-card-project">{project.name}</div>}
      <div className="kanban-card-title">{task.title}</div>
      <div className="kanban-card-meta">
        {when && <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{when}</span>}
        {showStatus && <span>{task.status}</span>}
        {task.context && <span>@{task.context}</span>}
        {task.energy && <span style={{ display: 'inline-flex', alignItems: 'center' }}><EnergyDots value={task.energy} size={3} /></span>}
        {task.timeEstimateMin && <span>{task.timeEstimateMin}m</span>}
        {task.rrule && <span style={{ display: 'inline-flex', alignItems: 'center' }}><IconRepeat size={10} /></span>}
      </div>
    </div>
  )
}

function KanbanCard({ task, project, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onOpen(task) }}
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', opacity: isDragging ? 0.35 : 1 }}
    >
      <CardContent task={task} project={project} />
    </div>
  )
}

interface ColProps {
  id: string
  label: string
  tasks: Task[]
  projects: Project[]
  onOpen: (task: Task) => void
  accent?: string
  droppable: boolean
}

function KanbanColumn({ id, label, tasks, projects, onOpen, accent, droppable }: ColProps) {
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
}

const MODE_LABELS: Record<Mode, string> = {
  quadrant: 'Quadrante',
  status: 'Status',
  area: 'Área',
  horizon: 'Horizonte',
  context: 'Contexto',
}

/**
 * Horizonte da task: deriva da data de vencimento; se a task não tem
 * data, cai no horizonte do projeto. Sem nenhum dos dois → null.
 */
function taskHorizon(t: Task, projectHorizon?: HorizonLvl): HorizonLvl | null {
  const iso = t.dueAt ?? (t.dueDate ? `${t.dueDate.slice(0, 10)}T12:00:00` : null)
  if (!iso) return projectHorizon ?? null
  const due = new Date(iso)
  if (isNaN(due.getTime())) return projectHorizon ?? null
  const now = new Date()
  const days = Math.floor((due.getTime() - now.getTime()) / 86400000)
  if (days <= 0) return 'H0'        // atrasado ou hoje
  if (days <= 7) return 'H1'        // esta semana
  if (days <= 92) return 'H2'       // trimestre
  if (days <= 730) return 'H3'      // 1-2 anos
  if (days <= 1825) return 'H4'     // 3-5 anos
  return 'H5'                       // vida
}

const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled'

export function KanbanView({ tasks, projects, areas, onOpen, onStatusChange, onQuadrantChange, onAreaChange, onContextChange }: Props) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('jp_kanban_mode') : null
    if (saved === 'quadrant' || saved === 'status' || saved === 'area' || saved === 'horizon' || saved === 'context') return saved
    return 'quadrant'
  })

  useEffect(() => {
    try { window.localStorage.setItem('jp_kanban_mode', mode) } catch { /* noop */ }
  }, [mode])

  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
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
      const current = task.quadrantOverride ?? task.resolvedQuadrant ?? null
      if (current !== newQuadrant) onQuadrantChange?.(taskId, newQuadrant)
    } else if (mode === 'area') {
      const newAreaId = overId === 'none' ? null : overId
      if ((task.areaId ?? null) !== newAreaId) onAreaChange?.(taskId, newAreaId)
    } else if (mode === 'context') {
      const newCtx = overId === 'none' ? null : (overId as TaskContext)
      if ((task.context ?? null) !== newCtx) onContextChange?.(taskId, newCtx)
    }
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) ?? null : null

  let columns: { id: string; label: string; tasks: Task[]; accent?: string }[] = []
  let droppable = mode === 'status' || mode === 'quadrant' || mode === 'area' || mode === 'context'

  // Modos não-status só mostram tasks abertas (done/cancelled saem).
  const openTasks = tasks.filter(isOpen)

  if (mode === 'status') {
    columns = STATUS_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      tasks: tasks.filter(t => t.status === c.key),
    }))
  } else if (mode === 'quadrant') {
    const effQ = (t: Task) => t.quadrantOverride ?? t.resolvedQuadrant
    columns = QUADRANT_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      accent: QUADRANT_COLORS[c.key],
      tasks: openTasks.filter(t => effQ(t) === c.key),
    }))
    columns.push({ id: 'none', label: 'sem quadrante', tasks: openTasks.filter(t => !effQ(t)) })
  } else if (mode === 'area') {
    columns = areas.map(a => ({
      id: a.id,
      label: a.name,
      accent: QUADRANT_COLORS[a.quadrant],
      tasks: openTasks.filter(t => t.areaId === a.id),
    }))
    columns.push({ id: 'none', label: 'sem área', tasks: openTasks.filter(t => !t.areaId) })
  } else if (mode === 'horizon') {
    const projHorizon = new Map(projects.map(p => [p.id, p.horizon]))
    const hz = (t: Task) => taskHorizon(t, projHorizon.get(t.projectId))
    columns = HORIZON_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      tasks: openTasks.filter(t => hz(t) === c.key),
    })).filter(c => c.tasks.length > 0)
    const semHorizon = openTasks.filter(t => hz(t) === null)
    if (semHorizon.length > 0) columns.push({ id: 'none', label: 'sem horizonte', tasks: semHorizon })
  } else if (mode === 'context') {
    columns = CONTEXT_COLUMNS.map(c => ({
      id: c.key,
      label: c.label,
      tasks: openTasks.filter(t => t.context === c.key),
    }))
    columns.push({ id: 'none', label: 'sem contexto', tasks: openTasks.filter(t => !t.context) })
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
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {body}
          <DragOverlay dropAnimation={null}>
            {activeTask
              ? <CardContent task={activeTask} project={projects.find(p => p.id === activeTask.projectId)} overlay />
              : null}
          </DragOverlay>
        </DndContext>
      ) : body}
    </div>
  )
}
