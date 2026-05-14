import { useState, useEffect } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { api } from '../api.ts'
import { QuickAdd } from '../components/tasks/QuickAdd.tsx'
import { TodayView } from '../components/tasks/TodayView.tsx'
import { KanbanView } from '../components/tasks/KanbanView.tsx'
import { ListView } from '../components/tasks/ListView.tsx'
import { TaskPanel } from '../components/tasks/TaskPanel.tsx'
import { InboxView } from '../components/inbox/InboxView.tsx'
import { ProjectsView } from '../components/projects/ProjectsView.tsx'
import { ProjectPanel } from '../components/projects/ProjectPanel.tsx'
import { useTasks } from '../hooks/useTasks.ts'
import { useProjects } from '../hooks/useProjects.ts'
import { useAreas } from '../hooks/useAreas.ts'
import { useInbox } from '../hooks/useInbox.ts'
import { applyQuery, hasFilter, type ParsedQuery } from '../lib/taskQueryParser.ts'
import type { Task, Project } from '../types/domain.ts'

const TABS = ['Today', 'Inbox', 'Kanban', 'Lista', 'Projetos', 'Gantt'] as const
type Tab = typeof TABS[number]

const EMPTY_TASK: Task = {
  id: '',
  userId: '',
  projectId: '',
  title: '',
  notes: '',
  status: 'next',
  priority: 'med',
  tags: [],
  dependsOn: [],
  archived: false,
  synced: false,
  createdAt: '',
  updatedAt: '',
  source: 'manual',
  aiClassified: false,
}

const EMPTY_PROJECT: Project = {
  id: '', userId: '', name: '', color: '#7dd3fc',
  archived: false, createdAt: '', updatedAt: '',
  kind: 'outcome', status: 'active', horizon: 'H1',
  position: 0, taskCount: 0, taskOpenCount: 0, childCount: 0,
}

export function TasksPage() {
  const [tab, setTab] = useState<Tab>('Today')
  const [selected, setSelected] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [creatingProject, setCreatingProject] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<ParsedQuery | null>(null)
  const { tasks: tasksRaw, loading, save, archive, updateStatus, classify, refetch: refetchTasks } = useTasks()
  const {
    projects, loading: projectsLoading,
    save: saveProject, archive: archiveProject, complete: completeProject,
    refetch: refetchProjects,
  } = useProjects()
  const { areas, loading: areasLoading } = useAreas()
  const { entries, loading: inboxLoading, capture, process, fetch: refetchInbox } = useInbox()

  useEffect(() => { setLastSync(localStorage.getItem('jp_tasks_last_sync')) }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.post('/api/tasks-sync')
      const ts = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      localStorage.setItem('jp_tasks_last_sync', ts)
      setLastSync(ts)
      await refetchTasks()
    } finally {
      setSyncing(false)
    }
  }

  const defaultProject = projects[0]

  const handleToggleDone = (task: Task) => {
    void updateStatus(task.id, task.status === 'done' ? 'next' : 'done')
  }

  const handleOpenStructured = () => {
    if (!defaultProject) {
      window.alert('Crie um projeto primeiro')
      return
    }
    setCreating(true)
  }

  const handleProcessInbox = async (input: Parameters<typeof process>[0]) => {
    const r = await process(input)
    if (input.action === 'to_task') await refetchTasks()
    return r
  }

  const tasks: Task[] = searchQuery && hasFilter(searchQuery)
    ? applyQuery(tasksRaw, searchQuery, { projects, areas })
    : tasksRaw

  const syncActions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
        <button className="sync-status" onClick={() => { void handleSync() }} disabled={syncing}>
          {syncing ? 'Sync…' : 'Sync'}
        </button>
        {lastSync && <span style={{ fontSize: '7px', fontFamily: 'Space Mono, monospace', color: 'var(--fg-dim)', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{lastSync}</span>}
      </div>
      <ThemeToggle />
    </div>
  )

  if (loading || projectsLoading || areasLoading) {
    return (
      <div>
        <Topbar title="Tasks" actions={<ThemeToggle />} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div>
      </div>
    )
  }

  const inboxCount = entries.length
  const tabsWithCount = TABS.map(t => t === 'Inbox' && inboxCount > 0 ? `Inbox (${inboxCount})` : t)
  const handleTabChange = (s: string) => {
    const cleaned = s.replace(/\s\(\d+\)$/, '') as Tab
    setTab(cleaned)
    if (cleaned === 'Inbox') void refetchInbox()
  }

  return (
    <div>
      <Topbar title="Tasks" actions={syncActions} />
      <Subtabs tabs={tabsWithCount} active={tab === 'Inbox' && inboxCount > 0 ? `Inbox (${inboxCount})` : tab} onChange={handleTabChange} />

      <QuickAdd
        projects={projects}
        areas={areas}
        onCapture={async (text) => { await capture(text) }}
        onCreateTask={async (input) => { await save(input); await refetchTasks() }}
        onOpenStructured={handleOpenStructured}
        onSearchChange={setSearchQuery}
      />

      {tab === 'Today' && (
        <TodayView
          tasks={tasks}
          projects={projects}
          onOpen={setSelected}
          onToggleDone={handleToggleDone}
        />
      )}

      {tab === 'Inbox' && (
        <InboxView
          entries={entries}
          projects={projects}
          areas={areas}
          loading={inboxLoading}
          defaultProjectId={defaultProject?.id}
          onProcess={handleProcessInbox}
          onOpenTask={setSelected}
          onToggleDone={handleToggleDone}
        />
      )}

      {tab === 'Kanban' && (
        <KanbanView
          tasks={tasks}
          projects={projects}
          areas={areas}
          onOpen={setSelected}
          onStatusChange={(id, status) => { void updateStatus(id, status) }}
          onQuadrantChange={(id, quadrant) => {
            const t = tasks.find(x => x.id === id)
            if (!t) return
            const input = { ...t, id: t.id, projectId: t.projectId, quadrantOverride: quadrant ?? undefined }
            void save(input)
          }}
          onAreaChange={(id, areaId) => {
            const t = tasks.find(x => x.id === id)
            if (!t) return
            const input = { ...t, id: t.id, projectId: t.projectId, areaId: areaId ?? undefined }
            void save(input)
          }}
        />
      )}

      {tab === 'Lista' && (
        <ListView
          tasks={tasks}
          projects={projects}
          areas={areas}
          onOpen={setSelected}
          onToggleDone={handleToggleDone}
        />
      )}

      {tab === 'Projetos' && (
        <ProjectsView
          projects={projects}
          areas={areas}
          tasks={tasks}
          onSelect={setSelectedProject}
          onCreate={() => setCreatingProject(true)}
          onOpenTask={setSelected}
          onToggleDone={handleToggleDone}
        />
      )}

      {tab === 'Gantt' && (
        <div className="content">
          <div className="empty-state">Gantt — em breve</div>
        </div>
      )}

      {selected && (
        <TaskPanel
          task={selected}
          projects={projects}
          areas={areas}
          onSave={async input => { await save(input) }}
          onArchive={async id => { await archive(id) }}
          onClassify={classify}
          onCreateProject={() => setCreatingProject(true)}
          onClose={() => setSelected(null)}
        />
      )}

      {creating && defaultProject && (
        <TaskPanel
          task={{ ...EMPTY_TASK, projectId: defaultProject.id }}
          projects={projects}
          areas={areas}
          isCreate
          onSave={async input => { await save(input); await refetchTasks() }}
          onArchive={async () => { /* unreachable in create mode */ }}
          onCreateProject={() => setCreatingProject(true)}
          onClose={() => setCreating(false)}
        />
      )}

      {selectedProject && (
        <ProjectPanel
          project={selectedProject}
          areas={areas}
          allProjects={projects}
          onSave={async input => { await saveProject(input) }}
          onArchive={async id => { await archiveProject(id); await refetchProjects() }}
          onComplete={async id => { await completeProject(id) }}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {creatingProject && (
        <ProjectPanel
          project={EMPTY_PROJECT}
          areas={areas}
          allProjects={projects}
          isCreate
          onSave={async input => { await saveProject(input); await refetchProjects(); setCreatingProject(false) }}
          onArchive={async () => { /* unreachable */ }}
          onClose={() => setCreatingProject(false)}
        />
      )}
    </div>
  )
}
