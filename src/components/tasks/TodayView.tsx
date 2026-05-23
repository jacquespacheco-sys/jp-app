import { useState, useEffect } from 'react'
import type { Task, Project, TaskContext, Quadrant } from '../../types/domain.ts'
import { TaskRow } from './TaskRow.tsx'
import { todayStr, addDaysStr, isSameLocalDay, dueDayKey, dueBucket, type TaskGroupKey } from '../../lib/taskDates.ts'

interface Props {
  tasks: Task[]
  projects: Project[]
  onOpen: (task: Task) => void
  onToggleDone: (task: Task) => void
  onSetQuadrant?: (task: Task, q: Quadrant | null) => void
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

export function TodayView({ tasks, projects, onOpen, onToggleDone, onSetQuadrant }: Props) {
  const [filter, setFilter] = useState<Filter>(loadFilter)
  const today = todayStr()

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

  const in7 = addDaysStr(today, 7)
  const pool = (hasFilter ? tasks.filter(matchesFilter) : tasks).filter(isOpen)

  const byPriority = (a: Task, b: Task) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  const groups: { key: TaskGroupKey; label: string; tasks: Task[] }[] = [
    { key: 'overdue', label: 'Atrasadas', tasks: [] },
    { key: 'today', label: 'Hoje', tasks: [] },
    { key: 'next7', label: 'Próximos 7 dias', tasks: [] },
    { key: 'undated', label: 'Sem data marcada', tasks: [] },
  ]
  for (const t of pool) {
    const g = dueBucket(dueDayKey(t), t.status, today, in7)
    if (g) groups.find(x => x.key === g)?.tasks.push(t)
  }
  for (const g of groups) g.tasks.sort(byPriority)
  const visibleGroups = groups.filter(g => g.tasks.length > 0)

  const scheduledToday = tasks.filter(t => isOpen(t) && isSameLocalDay(t.scheduledAt, today))
  const completedToday = tasks.filter(t =>
    t.status === 'done' && (isSameLocalDay(t.completedAt, today) || dueDayKey(t) === today)
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

      {visibleGroups.length === 0 ? (
        <div className="task-group">
          <div className="empty-state">{hasFilter ? 'Nada bate com esse filtro' : 'Nenhuma tarefa'}</div>
        </div>
      ) : (
        visibleGroups.map(g => (
          <div className="task-group" key={g.key}>
            <div className="task-group-title">
              {g.label}
              <span className="task-group-count">{g.tasks.length}</span>
            </div>
            {g.tasks.map(task => (
              <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} {...(onSetQuadrant ? { onSetQuadrant } : {})} />
            ))}
          </div>
        ))
      )}

      {scheduledToday.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Scheduled hoje
            <span className="task-group-count">{scheduledToday.length}</span>
          </div>
          {scheduledToday.map(task => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} {...(onSetQuadrant ? { onSetQuadrant } : {})} />
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
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpen} onToggleDone={onToggleDone} {...(onSetQuadrant ? { onSetQuadrant } : {})} />
          ))}
        </div>
      )}
    </div>
  )
}
