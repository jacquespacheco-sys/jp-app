import { useState, type FormEvent } from 'react'
import type { TaskSaveInput } from '../../../api/_schemas/task.ts'
import type { Project } from '../../types/domain.ts'

interface Props {
  defaultProject: Project
  onAdd: (input: TaskSaveInput) => Promise<void>
}

function parseInput(raw: string): { title: string; priority: TaskSaveInput['priority']; dueDate?: string; tags: string[] } {
  let text = raw.trim()
  let priority: TaskSaveInput['priority'] = 'med'
  let dueDate: string | undefined
  const tags: string[] = []

  // Priority
  if (/!alta|!p1/i.test(text)) { priority = 'high'; text = text.replace(/!alta|!p1/gi, '').trim() }
  else if (/!baixa|!p3/i.test(text)) { priority = 'low'; text = text.replace(/!baixa|!p3/gi, '').trim() }
  else if (/!media|!p2/i.test(text)) { priority = 'med'; text = text.replace(/!media|!p2/gi, '').trim() }

  // Date
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (/\bhoje\b/i.test(text)) {
    dueDate = fmt(today)
    text = text.replace(/\bhoje\b/gi, '').trim()
  } else if (/\bamanh[ãa]\b/i.test(text)) {
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    dueDate = fmt(tomorrow)
    text = text.replace(/\bamanh[ãa]\b/gi, '').trim()
  }

  // Tags
  const tagMatches = text.match(/#[\w-]+/g)
  if (tagMatches) {
    tags.push(...tagMatches.map(t => t.slice(1)))
    text = text.replace(/#[\w-]+/g, '').trim()
  }

  const result: { title: string; priority: TaskSaveInput['priority']; dueDate?: string; tags: string[] } = { title: text, priority, tags }
  if (dueDate) result.dueDate = dueDate
  return result
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
