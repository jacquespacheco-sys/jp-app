import { useState, useEffect } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { ProjectsView } from '../components/projects/ProjectsView.tsx'
import { ProjectPanel } from '../components/projects/ProjectPanel.tsx'
import { useProjects } from '../hooks/useProjects.ts'
import { useAreas } from '../hooks/useAreas.ts'
import type { Project } from '../types/domain.ts'

type Mode = 'horizon' | 'area' | 'flat'
type StatusFilter = 'active' | 'on_hold' | 'someday' | 'done'

const STORAGE_KEY = 'jp_projects_groupby'

const EMPTY_PROJECT: Project = {
  id: '', userId: '', name: '', color: '#7dd3fc',
  archived: false, createdAt: '', updatedAt: '',
  kind: 'outcome', status: 'active', horizon: 'H1',
  position: 0, taskCount: 0, taskOpenCount: 0, childCount: 0,
}

function loadMode(): Mode {
  if (typeof window === 'undefined') return 'horizon'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'horizon' || saved === 'area' || saved === 'flat') return saved
  return 'horizon'
}

export function ProjectsPage() {
  const [mode, setMode] = useState<Mode>(loadMode)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [selected, setSelected] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const { projects, loading, save, archive, complete, refetch } = useProjects({ status: statusFilter })
  const { areas, loading: areasLoading } = useAreas()

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, mode) } catch { /* noop */ }
  }, [mode])

  if (loading || areasLoading) {
    return (
      <div>
        <Topbar title="Projetos" actions={<ThemeToggle />} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="Projetos" actions={<ThemeToggle />} />

      <div className="projects-toolbar">
        <div className="projects-toolbar-group">
          {(['horizon', 'area', 'flat'] as Mode[]).map(m => (
            <button key={m}
              className={`kanban-mode-btn${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}>
              {m === 'horizon' ? 'Horizonte' : m === 'area' ? 'Área' : 'Flat'}
            </button>
          ))}
        </div>
        <div className="projects-toolbar-group">
          {(['active', 'on_hold', 'someday', 'done'] as StatusFilter[]).map(s => (
            <button key={s}
              className={`kanban-mode-btn${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}>
              {s === 'active' ? 'ativos' : s === 'on_hold' ? 'pausados' : s === 'someday' ? 'algum dia' : 'concluídos'}
            </button>
          ))}
        </div>
        <button className="btn btn-accent projects-new-btn" onClick={() => setCreating(true)}>
          + novo
        </button>
      </div>

      <ProjectsView
        projects={projects}
        areas={areas}
        mode={mode}
        onSelect={setSelected}
      />

      {selected && (
        <ProjectPanel
          project={selected}
          areas={areas}
          allProjects={projects}
          onSave={async input => { await save(input) }}
          onArchive={async id => { await archive(id) }}
          onComplete={async id => { await complete(id) }}
          onClose={() => setSelected(null)}
        />
      )}

      {creating && (
        <ProjectPanel
          project={EMPTY_PROJECT}
          areas={areas}
          allProjects={projects}
          isCreate
          onSave={async input => { await save(input); await refetch() }}
          onArchive={async () => { /* unreachable */ }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
