import type { InboxEntry, InboxItem, Task, Project } from '../../types/domain.ts'
import type { InboxProcessInput } from '../../../api/_schemas/inbox.ts'
import { TaskRow } from '../tasks/TaskRow.tsx'

interface Props {
  entries: InboxEntry[]
  projects: Project[]
  loading: boolean
  defaultProjectId: string | undefined
  onProcess: (input: InboxProcessInput) => Promise<unknown>
  onOpenTask: (task: Task) => void
  onToggleDone: (task: Task) => void
}

export function InboxView({ entries, projects, loading, defaultProjectId, onProcess, onOpenTask, onToggleDone }: Props) {
  if (loading) {
    return <div className="content"><div className="empty-state">Carregando inbox…</div></div>
  }

  const items = entries.filter((e): e is { kind: 'inbox_item'; data: InboxItem } => e.kind === 'inbox_item')
  const tasks = entries.filter((e): e is { kind: 'task'; data: Task } => e.kind === 'task')

  if (items.length === 0 && tasks.length === 0) {
    return (
      <div className="content">
        <div className="empty-state">
          Inbox limpa ✨<br />
          <span style={{ fontSize: '11px', opacity: 0.6 }}>capture algo no input acima ou aguarde fontes externas</span>
        </div>
      </div>
    )
  }

  const handleToTask = async (item: InboxItem) => {
    if (!defaultProjectId) {
      window.alert('Crie um projeto primeiro pra mover capturas pra task')
      return
    }
    await onProcess({
      id: item.id,
      action: 'to_task',
      taskFields: {
        title: item.rawText,
        projectId: defaultProjectId,
        status: 'next',
      },
    })
  }

  const handleToProject = async (item: InboxItem) => {
    if (!window.confirm(`Criar projeto "${item.rawText.slice(0, 60)}…"?`)) return
    await onProcess({ id: item.id, action: 'to_project' })
  }

  const handleTrash = async (item: InboxItem) => {
    await onProcess({ id: item.id, action: 'trash' })
  }

  return (
    <div className="content">
      {items.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Capturas
            <span className="task-group-count">{items.length}</span>
          </div>
          {items.map(({ data: item }) => (
            <div key={item.id} className="inbox-item">
              <div className="inbox-item-text">{item.rawText}</div>
              <div className="inbox-item-meta">
                <span>{item.source}</span>
                <span>{new Date(item.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                {item.aiSuggestion && <span>✨ classificada</span>}
              </div>
              <div className="inbox-item-actions">
                <button className="inbox-action" onClick={() => { void handleToTask(item) }}>→ task</button>
                <button className="inbox-action" onClick={() => { void handleToProject(item) }}>→ projeto</button>
                <button className="inbox-action danger" onClick={() => { void handleTrash(item) }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="task-group">
          <div className="task-group-title">
            Tasks status=inbox
            <span className="task-group-count">{tasks.length}</span>
          </div>
          {tasks.map(({ data: task }) => (
            <TaskRow key={task.id} task={task} projects={projects} onOpen={onOpenTask} onToggleDone={onToggleDone} />
          ))}
        </div>
      )}
    </div>
  )
}
