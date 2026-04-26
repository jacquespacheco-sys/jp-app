import { useState, useEffect } from 'react'
import type { Task, Project } from '../../types/domain.ts'
import type { TaskSaveInput } from '../../../api/_schemas/task.ts'
import { ConfirmDialog } from '../common/ConfirmDialog.tsx'

interface Props {
  task: Task
  projects: Project[]
  onSave: (input: TaskSaveInput) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onClose: () => void
}

export function TaskPanel({ task, projects, onSave, onArchive, onClose }: Props) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [projectId, setProjectId] = useState(task.projectId)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [tags, setTags] = useState(task.tags.join(', '))
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setTitle(task.title); setNotes(task.notes); setStatus(task.status)
    setPriority(task.priority); setProjectId(task.projectId)
    setDueDate(task.dueDate ?? ''); setTags(task.tags.join(', '))
  }, [task])

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSave({
        id: task.id,
        title: title.trim(),
        notes,
        status,
        priority,
        projectId,
        dueDate: dueDate || undefined,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        dependsOn: task.dependsOn,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    setSaving(true)
    try {
      await onArchive(task.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="task-panel-overlay" onClick={onClose}>
        <div className="task-panel" onClick={e => e.stopPropagation()}>
          <div className="task-panel-header">
            <span className="task-panel-label">Tarefa</span>
            <button className="task-panel-close" onClick={onClose}>×</button>
          </div>

          <div className="task-panel-body">
            <textarea
              className="task-panel-title-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              rows={2}
              placeholder="Título da tarefa"
            />

            <div className="task-field">
              <span className="task-field-label">Status</span>
              <select className="task-field-select" value={status} onChange={e => setStatus(e.target.value as Task['status'])}>
                <option value="inbox">Inbox</option>
                <option value="next">Próxima</option>
                <option value="doing">Fazendo</option>
                <option value="blocked">Bloqueada</option>
                <option value="done">Concluída</option>
              </select>
            </div>

            <div className="task-field">
              <span className="task-field-label">Prioridade</span>
              <select className="task-field-select" value={priority} onChange={e => setPriority(e.target.value as Task['priority'])}>
                <option value="high">Alta</option>
                <option value="med">Média</option>
                <option value="low">Baixa</option>
              </select>
            </div>

            <div className="task-field">
              <span className="task-field-label">Projeto</span>
              <select className="task-field-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="task-field">
              <span className="task-field-label">Prazo</span>
              <input type="date" className="task-field-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>

            <div className="task-field">
              <span className="task-field-label">Tags</span>
              <input className="task-field-input" placeholder="tag1, tag2" value={tags} onChange={e => setTags(e.target.value)} />
            </div>

            <span className="task-panel-notes-label">Notas</span>
            <textarea
              className="task-panel-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anotações…"
            />
          </div>

          <div className="task-panel-actions">
            <button className="btn btn-ghost" onClick={() => setConfirmOpen(true)} disabled={saving}>
              Arquivar
            </button>
            <button className="btn btn-accent" onClick={() => { void handleSave() }} disabled={saving || !title.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Arquivar tarefa"
        message="Esta tarefa será removida da lista."
        detail={task.title}
        confirmLabel="Arquivar"
        onConfirm={() => { void handleArchive() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
