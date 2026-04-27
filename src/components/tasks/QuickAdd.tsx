import { useState, type FormEvent } from 'react'
import type { TaskSaveInput } from '../../../api/_schemas/task.ts'
import type { Project } from '../../types/domain.ts'
import { parseInput } from '../../lib/taskParser.ts'

interface Props {
  defaultProject: Project
  onAdd: (input: TaskSaveInput) => Promise<void>
}

export function QuickAdd({ defaultProject, onAdd }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    setError('')
    try {
      const { title, priority, dueDate, tags } = parseInput(trimmed)
      await onAdd({ title, priority, dueDate, tags, projectId: defaultProject.id, notes: '', status: 'next', dependsOn: [] })
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar tarefa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="quick-add">
      <form onSubmit={e => { void handleSubmit(e) }}>
        <input
          className="quick-add-input"
          placeholder="Nova tarefa… !alta hoje #tag"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={saving}
          autoComplete="off"
        />
      </form>
      {error && <div style={{ color: 'var(--danger)', fontFamily: 'Space Mono, monospace', fontSize: '10px', marginTop: '6px', letterSpacing: '1px' }}>{error}</div>}
      <div className="quick-add-hints">
        <span>!alta · !media · !baixa</span>
        <span>hoje · amanhã</span>
        <span>#tag</span>
        <span>↵ para criar</span>
      </div>
    </div>
  )
}
