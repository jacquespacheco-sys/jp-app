import { useState, useEffect } from 'react'
import type { Task, Project, TaskContext } from '../../types/domain.ts'
import { TaskRow } from './TaskRow.tsx'

interface Props {
  tasks: Task[]
  projects: Project[]
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
}

const today = (): string => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const isToday = (iso?: string): boolean => {
  if (!iso) return false
  const d = new Date(iso)
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === today()
}

const PRIORITY_ORDER: Record<Task['priority'], number> = { high: 0, med: 1, low: 2 }

const CONTEXTS: TaskContext[] = ['deep', 'shallow', 'social', 'criativo', 'somatico', 'offline']
const CONTEXT_COLORS: Record<TaskContext, string> = {
  deep: '#6B5E72', shallow: '#8A8075', social: '#A06C4C',
  criativo: '#9B6B73', somatico: '#5C8159', offline: '#A99E91',
}

interface Filter {
  contexts: TaskContext[]
  minEnergy: number | null
}

const STORAGE_KEY = 'jp_today_filter'

function loadFilter(): Filter {
  if (typeof window === 'undefined') return { contexts: [], minEnergy: null }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { contexts: [], minEnergy: null }
    const parsed = JSON.parse(raw) as Filter
    return parsed
  } catch {
    return { contexts: [], minEnergy: null }
  }
}

export function TodayView({ tasks, projects, onOpen, onToggleDone }: Props) {
  const [filter, setFilter] = useState<Filter>(loadFilter)
  const todayStr = today()

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filter)) } catch { /* noop */ }
  }, [filter])

  const toggleContext = (c: TaskContext) => {
    setFilter(f => ({
      ...f,
      contexts: f.contexts.includes(c) ? f.contexts.filter(x => x !== c) : [...f.contexts, c],
    }))
  }

  const setEnergy = (n: number | null) => setFilter(f => ({ ...f, minEnergy: n }))

  const clear = () => setFilter({ contexts: [], minEnergy: null })

  const hasFilter = filter.contexts.length > 0 || filter.minEnergy !== null

  const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled' && t.status !== 'someday'
  const matchesFilter = (t: Task): boolean => {
    if (filter.contexts.length > 0 && (!t.context || !filter.contexts.includes(t.context))) return false
    if (filter.minEnergy !== null && (t.energy ?? 0) < filter.minEnergy) return false
    return true
  }

  const dueOrToday = tasks.filter(t => {
    if (!isOpen(t)) return false
    if (t.status === 'doing') return true
    if (isToday(t.dueAt) || t.dueDate === todayStr) return true
    if (t.dueDate && t.dueDate < todayStr) return true
    if (t.status === 'next' || t.status === 'inbox') return true
    return false
  })

  const filtered = hasFilter ? dueOrToday.filter(matchesFilter) : dueOrToday
  filtered.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  const scheduledToday = tasks.filter(t => isOpen(t) && isToday(t.scheduledAt))
  const completedToday = tasks.filter(t =>
    t.status === 'done' && (isToday(t.completedAt) || t.dueDate === todayStr)
  )

  return (
    <div className="content">
      <div className="today-filter-bar">
        <span className="today-filter-label">eu estou:</span>
        {CONTEXTS.map(c => {
          const active = filter.contexts.includes(c)
          const color = CONTEXT_COLORS[c]
          const style = active
            ? { background: `${color}33`, borderColor: `${color}88`, color: 'var(--fg)' }
            : { borderLeftWidth: '3px', borderLeftStyle: 'solid' as const, borderLeftColor: color }
          return (
            <button
              key={c}
              className={`today-filter-chip${active ? ' active' : ''}`}
              onClick={() => toggleContext(c)}
              style={style}
            >
              @{c}
            </button>
          )
        })}
        <span className="today-filter-divider">⚡</span>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className={`today-filter-chip${filter.minEnergy === n ? ' active' : ''}`}
            onClick={() => setEnergy(filter.minEnergy === n ? null : n)}
          >
            ≥{n}
          </button>
        ))}
        {hasFilter && (
          <button className="today-filter-clear" onClick={clear}>limpar</button>
        )}
      </div>

      <div className="task-group">
        <div className="task-group-title">
          {hasFilter ? 'Filtrado' : 'Hoje'}
          <span className="task-group-count">{filtered.length}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">{hasFilter ? 'Nada bate com esse filtro' : 'Nenhuma tarefa para hoje'}</div>
        ) : (
          filtered.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))
        )}
      </div>

      {scheduledToday.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Scheduled hoje
            <span className="task-group-count">{scheduledToday.length}</span>
          </div>
          {scheduledToday.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </div>
      )}

      {completedToday.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Concluído hoje
            <span className="task-group-count">{completedToday.length}</span>
          </div>
          {completedToday.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} />
          ))}
        </div>
      )}
    </div>
  )
}
