import { useState, useEffect, useMemo } from 'react'
import type { Project, Area, Task, HorizonLvl, Quadrant } from '../../types/domain.ts'
import { QUADRANT_COLORS, QUADRANT_LABELS } from '../../types/domain.ts'
import { ProjectRow } from './ProjectRow.tsx'
import { TaskRow } from '../tasks/TaskRow.tsx'
import { IconPlus } from '../common/Icon.tsx'

type Mode = 'horizon' | 'area' | 'flat'

interface Props {
  projects: Project[]
  areas: Area[]
  onSelect: (project: Project) => void
  tasks?: Task[]
  onCreate?: () => void
  onOpenTask?: (task: Task) => void
  onToggleDone?: (task: Task) => void
}

const MODE_LABELS: Record<Mode, string> = {
  horizon: 'Horizonte',
  area: 'Área',
  flat: 'Lista',
}

const HORIZON_ORDER: HorizonLvl[] = ['H0', 'H1', 'H2', 'H3', 'H4', 'H5']
const HORIZON_LABELS: Record<HorizonLvl, string> = {
  H0: 'H0 · agora', H1: 'H1 · esta semana', H2: 'H2 · trimestre',
  H3: 'H3 · 1-2 anos', H4: 'H4 · 3-5 anos', H5: 'H5 · vida',
}

const QUADRANTS: Quadrant[] = ['I', 'IT', 'WE', 'ITS']

const STORAGE_MODE = 'jp_projects_mode'
const STORAGE_FILTER = 'jp_projects_filter'

interface PersistedFilter {
  quadrants?: Quadrant[]
  areaIds?: string[]
  horizons?: HorizonLvl[]
}

function loadMode(): Mode {
  if (typeof window === 'undefined') return 'horizon'
  const v = window.localStorage.getItem(STORAGE_MODE)
  return v === 'horizon' || v === 'area' || v === 'flat' ? v : 'horizon'
}

function loadFilter(): PersistedFilter {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_FILTER)
    return raw ? JSON.parse(raw) as PersistedFilter : {}
  } catch { return {} }
}

interface Group {
  id: string
  label: string
  accent?: string
  projects: Project[]
}

function groupProjects(projects: Project[], areas: Area[], mode: Mode): Group[] {
  const parents = projects.filter(p => !p.parentId)

  if (mode === 'horizon') {
    return HORIZON_ORDER
      .map(h => ({
        id: h,
        label: HORIZON_LABELS[h],
        projects: parents.filter(p => p.horizon === h),
      }))
      .filter(g => g.projects.length > 0)
  }

  if (mode === 'area') {
    const groups: Group[] = []
    for (const a of areas) {
      const ps = parents.filter(p => p.areaId === a.id)
      if (ps.length > 0) {
        groups.push({ id: a.id, label: a.name, accent: QUADRANT_COLORS[a.quadrant], projects: ps })
      }
    }
    const noArea = parents.filter(p => !p.areaId)
    if (noArea.length > 0) groups.push({ id: 'none', label: 'sem área', projects: noArea })
    return groups
  }

  return [{ id: 'all', label: '', projects: parents }]
}

export function ProjectsView({ projects, areas, tasks = [], onSelect, onCreate, onOpenTask, onToggleDone }: Props) {
  const canExpand = onOpenTask !== undefined && onToggleDone !== undefined
  const [mode, setMode] = useState<Mode>(loadMode)
  const [filter, setFilter] = useState<PersistedFilter>(loadFilter)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_MODE, mode) } catch { /* noop */ }
  }, [mode])
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_FILTER, JSON.stringify(filter)) } catch { /* noop */ }
  }, [filter])

  const tasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const arr = map.get(t.projectId) ?? []
      arr.push(t)
      map.set(t.projectId, arr)
    }
    return map
  }, [tasks])

  const quadSet = new Set(filter.quadrants ?? [])
  const areaSet = new Set(filter.areaIds ?? [])
  const horSet = new Set(filter.horizons ?? [])

  const toggleQuad = (q: Quadrant) => setFilter(f => {
    const s = new Set(f.quadrants ?? [])
    s.has(q) ? s.delete(q) : s.add(q)
    return { ...f, quadrants: s.size > 0 ? [...s] : undefined as never }
  })
  const toggleArea = (id: string) => setFilter(f => {
    const s = new Set(f.areaIds ?? [])
    s.has(id) ? s.delete(id) : s.add(id)
    return { ...f, areaIds: s.size > 0 ? [...s] : undefined as never }
  })
  const toggleHorizon = (h: HorizonLvl) => setFilter(f => {
    const s = new Set(f.horizons ?? [])
    s.has(h) ? s.delete(h) : s.add(h)
    return { ...f, horizons: s.size > 0 ? [...s] : undefined as never }
  })
  const clearFilter = () => setFilter({})
  const hasFilter = quadSet.size + areaSet.size + horSet.size > 0

  const filtered = projects.filter(p => {
    if (quadSet.size > 0) {
      const q = p.resolvedQuadrant
      if (!q || !quadSet.has(q)) return false
    }
    if (areaSet.size > 0 && (!p.areaId || !areaSet.has(p.areaId))) return false
    if (horSet.size > 0 && !horSet.has(p.horizon)) return false
    return true
  })

  const childrenByParent = new Map<string, Project[]>()
  for (const p of filtered) {
    if (p.parentId) {
      const arr = childrenByParent.get(p.parentId) ?? []
      arr.push(p)
      childrenByParent.set(p.parentId, arr)
    }
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const groups = groupProjects(filtered, areas, mode)

  return (
    <div>
      <div className="projects-bar">
        <div className="projects-mode-bar">
          {(Object.keys(MODE_LABELS) as Mode[]).map(m => (
            <button
              key={m}
              className={`kanban-mode-btn${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
          {onCreate && (
            <button className="quick-add-structured-btn" style={{ marginLeft: 'auto' }} onClick={onCreate}>
              <IconPlus size={12} /> projeto
            </button>
          )}
        </div>

        <div className="projects-filter-row">
          {QUADRANTS.map(q => (
            <button
              key={q}
              className={`today-filter-chip${quadSet.has(q) ? ' active' : ''}`}
              onClick={() => toggleQuad(q)}
              style={{ borderLeft: `3px solid ${QUADRANT_COLORS[q]}` }}
              title={QUADRANT_LABELS[q]}
            >
              {q}
            </button>
          ))}
          <span className="today-filter-divider">·</span>
          {HORIZON_ORDER.map(h => (
            <button
              key={h}
              className={`today-filter-chip${horSet.has(h) ? ' active' : ''}`}
              onClick={() => toggleHorizon(h)}
              title={HORIZON_LABELS[h]}
            >
              {h}
            </button>
          ))}
          {areas.length > 0 && <span className="today-filter-divider">·</span>}
          {areas.map(a => (
            <button
              key={a.id}
              className={`today-filter-chip${areaSet.has(a.id) ? ' active' : ''}`}
              onClick={() => toggleArea(a.id)}
              style={{ borderLeft: `3px solid ${QUADRANT_COLORS[a.quadrant]}` }}
            >
              {a.name}
            </button>
          ))}
          {hasFilter && <button className="today-filter-clear" onClick={clearFilter}>limpar</button>}
        </div>
      </div>

      <div className="content">
        {groups.length === 0 && (
          <div className="empty-state">
            {projects.length === 0 ? 'Nenhum projeto. Crie o primeiro com + projeto.' : 'Nenhum projeto neste filtro'}
          </div>
        )}

        {groups.map(g => (
          <div key={g.id} className="task-group">
            {g.label && (
              <div className="task-group-title" style={g.accent ? { color: g.accent } : undefined}>
                {g.label}
                <span className="task-group-count">{g.projects.length}</span>
              </div>
            )}
            {g.projects.map(p => {
              const isExpanded = expanded.has(p.id)
              const projectTasks = tasksByProject.get(p.id) ?? []
              const openTasks = projectTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled')
              const doneTasks = projectTasks.filter(t => t.status === 'done')

              return (
                <div key={p.id}>
                  {canExpand ? (
                    <div className="project-row-wrapper">
                      <button
                        type="button"
                        className="project-expand"
                        onClick={() => toggleExpand(p.id)}
                        aria-label={isExpanded ? 'Recolher tarefas' : 'Expandir tarefas'}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                      <div style={{ flex: 1 }}>
                        <ProjectRow project={p} areas={areas} onSelect={onSelect} />
                      </div>
                    </div>
                  ) : (
                    <ProjectRow project={p} areas={areas} onSelect={onSelect} />
                  )}
                  {(childrenByParent.get(p.id) ?? []).map(child => (
                    <ProjectRow key={child.id} project={child} areas={areas} isChild onSelect={onSelect} />
                  ))}
                  {canExpand && isExpanded && onOpenTask && onToggleDone && (
                    <div className="project-tasks-inline">
                      {openTasks.length === 0 && doneTasks.length === 0 && (
                        <div className="empty-state" style={{ padding: '12px', fontSize: '11px' }}>Sem tarefas neste projeto</div>
                      )}
                      {openTasks.map(t => (
                        <TaskRow key={t.id} task={t} projects={projects} onOpen={onOpenTask} onToggleDone={onToggleDone} />
                      ))}
                      {doneTasks.length > 0 && (
                        <details className="project-tasks-done">
                          <summary>concluídas ({doneTasks.length})</summary>
                          {doneTasks.map(t => (
                            <TaskRow key={t.id} task={t} projects={projects} onOpen={onOpenTask} onToggleDone={onToggleDone} />
                          ))}
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
