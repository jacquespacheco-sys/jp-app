import { useState } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
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
  const { tasks, loading, save, archive, updateStatus } = useTasks()
  const { projects, loading: projectsLoading } = useProjects()

  const defaultProject = projects[0]

  const handleToggleDone = (task: Task) => {
    void updateStatus(task.id, task.status === 'done' ? 'next' : 'done')
  }

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
      <Topbar title="Tasks" actions={<ThemeToggle />} />
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
          onSave={async input => { await save(input) }}
          onArchive={async id => { await archive(id) }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
