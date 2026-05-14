import { useState, useEffect, useMemo, useRef } from 'react'
import type { Task, Project, Area } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'

export interface TaskFilter {
  projectIds?: string[]
  areaIds?: string[]
  tags?: string[]
}

interface Props {
  storageKey: string
  value: TaskFilter
  onChange: (filter: TaskFilter) => void
  projects: Project[]
  areas: Area[]
  tasks: Task[]
}

export function persistedTaskFilter(storageKey: string): TaskFilter {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as TaskFilter
    return parsed ?? {}
  } catch {
    return {}
  }
}

export function applyTaskFilter(tasks: Task[], filter: TaskFilter): Task[] {
  if (!filter.projectIds && !filter.areaIds && !filter.tags) return tasks
  return tasks.filter(t => {
    if (filter.projectIds?.length && !filter.projectIds.includes(t.projectId)) return false
    if (filter.areaIds?.length) {
      if (!t.areaId || !filter.areaIds.includes(t.areaId)) return false
    }
    if (filter.tags?.length) {
      if (!filter.tags.some(tag => t.tags.includes(tag))) return false
    }
    return true
  })
}

export function TaskFilterBar({ storageKey, value, onChange, projects, areas, tasks }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(value)) }
    catch { /* ignore quota */ }
  }, [storageKey, value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  const projectsById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])
  const areasById = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) for (const tag of t.tags) s.add(tag)
    return [...s].sort()
  }, [tasks])

  const projectSet = new Set(value.projectIds ?? [])
  const areaSet = new Set(value.areaIds ?? [])
  const tagSet = new Set(value.tags ?? [])

  const toggleProject = (id: string) => {
    const next = new Set(projectSet)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange({ ...value, projectIds: next.size > 0 ? [...next] : undefined as never } as TaskFilter)
  }
  const toggleArea = (id: string) => {
    const next = new Set(areaSet)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange({ ...value, areaIds: next.size > 0 ? [...next] : undefined as never } as TaskFilter)
  }
  const toggleTag = (tag: string) => {
    const next = new Set(tagSet)
    if (next.has(tag)) next.delete(tag); else next.add(tag)
    onChange({ ...value, tags: next.size > 0 ? [...next] : undefined as never } as TaskFilter)
  }
  const clear = () => onChange({})

  const activeCount =
    (value.projectIds?.length ?? 0) +
    (value.areaIds?.length ?? 0) +
    (value.tags?.length ?? 0)

  return (
    <div ref={wrapRef} style={{
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {value.projectIds?.map(id => {
          const p = projectsById.get(id)
          if (!p) return null
          return <FilterChip key={`p-${id}`} label={`projeto · ${p.name}`} onRemove={() => toggleProject(id)} accent={p.color} />
        })}
        {value.areaIds?.map(id => {
          const a = areasById.get(id)
          if (!a) return null
          return <FilterChip key={`a-${id}`} label={`área · ${a.name}`} onRemove={() => toggleArea(id)} accent={QUADRANT_COLORS[a.quadrant]} />
        })}
        {value.tags?.map(tag => (
          <FilterChip key={`t-${tag}`} label={`#${tag}`} onRemove={() => toggleTag(tag)} />
        ))}
        <button
          className="btn btn-ghost"
          style={{ fontSize: '9px', padding: '4px 10px' }}
          onClick={() => setOpen(v => !v)}
        >
          {activeCount > 0 ? `+ Filtro (${activeCount})` : '+ Filtro'}
        </button>
        {activeCount > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: '9px', padding: '4px 10px', color: 'var(--danger)' }}
            onClick={clear}
          >
            Limpar
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% - 1px)', right: '16px', zIndex: 30,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          padding: '14px', minWidth: '280px', maxWidth: '380px',
          maxHeight: '60vh', overflowY: 'auto',
          boxShadow: 'var(--shadow)',
        }}>
          {projects.length > 0 && (
            <Section title="Projetos">
              {projects.map(p => (
                <OptionRow key={p.id} checked={projectSet.has(p.id)} onToggle={() => toggleProject(p.id)}>
                  <span style={{
                    width: '8px', height: '8px', display: 'inline-block',
                    background: p.color, marginRight: '6px',
                  }} />
                  {p.name}
                </OptionRow>
              ))}
            </Section>
          )}

          {areas.length > 0 && (
            <Section title="Áreas">
              {areas.map(a => (
                <OptionRow key={a.id} checked={areaSet.has(a.id)} onToggle={() => toggleArea(a.id)}>
                  <span style={{
                    width: '8px', height: '8px', display: 'inline-block',
                    background: QUADRANT_COLORS[a.quadrant], marginRight: '6px',
                  }} />
                  {a.name}
                </OptionRow>
              ))}
            </Section>
          )}

          {allTags.length > 0 && (
            <Section title="Tags">
              {allTags.map(tag => (
                <OptionRow key={tag} checked={tagSet.has(tag)} onToggle={() => toggleTag(tag)}>
                  #{tag}
                </OptionRow>
              ))}
            </Section>
          )}

          {projects.length === 0 && areas.length === 0 && allTags.length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--fg-dim)', padding: '8px' }}>
              Sem opções de filtro disponíveis.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove, accent }: { label: string; onRemove: () => void; accent?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', fontSize: '10px',
      fontFamily: 'Space Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase',
      background: 'var(--bg-elevated)', color: 'var(--fg-muted)',
      border: '1px solid var(--border)',
      ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 'inherit', opacity: 0.6 }}
        title="Remover"
      >
        ×
      </button>
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gap: '4px' }}>{children}</div>
    </div>
  )
}

function OptionRow({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      fontSize: '12px', color: 'var(--fg)',
      cursor: 'pointer', padding: '3px 0',
    }}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {children}
    </label>
  )
}
