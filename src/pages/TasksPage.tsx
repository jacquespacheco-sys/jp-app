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
import { useTasks } from '../hooks/useTasks.ts'
import { useProjects } from '../hooks/useProjects.ts'
import type { Task } from '../types/domain.ts'

const TABS = ['Today', 'Kanban', 'Lista', 'Gantt'] as const
type Tab = typeof TABS[number]

export function TasksPage() {
  const [tab, setTab] = useState<Tab>('Today')
  const [selected, setSelected] = useState<Task | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const { tasks, loading, save, archive, updateStatus } = useTasks()
  const { projects, loading: projectsLoading } = useProjects()

  useEffect(() => { setLastSync(localStorage.getItem('jp_tasks_last_sync')) }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.post('/api/tasks-sync')
      const ts = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      localStorage.setItem('jp_tasks_last_sync', ts)
      setLastSync(ts)
    } finally {
      setSyncing(false)
    }
  }

  const defaultProject = projects[0]

  const handleToggleDone = (task: Task) => {
    void updateStatus(task.id, task.status === 'done' ? 'next' : 'done')
  }

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

  if (loading || projectsLoading) {
    return (
      <div>
        <Topbar title="Tasks" actions={<ThemeToggle />} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="Tasks" actions={syncActions} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {defaultProject && (
        <QuickAdd
          defaultProject={defaultProject}
          onAdd={async input => { await save(input) }}
        />
      )}

      {tab === 'Today' && (
        <TodayView
          tasks={tasks}
          projects={projects}
          onOpen={setSelected}
          onToggleDone={handleToggleDone}
        />
      )}

      {tab === 'Kanban' && (
        <KanbanView
          tasks={tasks}
          projects={projects}
          onOpen={setSelected}
          onStatusChange={(id, status) => { void updateStatus(id, status) }}
        />
      )}

      {tab === 'Lista' && (
        <ListView
          tasks={tasks}
          projects={projects}
          onOpen={setSelected}
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
          areas={[]}
          onSave={async input => { await save(input) }}
          onArchive={async id => { await archive(id) }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
