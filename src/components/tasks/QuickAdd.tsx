import { useState, useMemo, type FormEvent } from 'react'
import type { Project, Area } from '../../types/domain.ts'
import type { TaskSaveInput } from '../../../api/_schemas/task.ts'
import { parseInput, hasStructure, type ParsedTask } from '../../lib/taskParser.ts'
import { parseQuery, hasFilter, type ParsedQuery } from '../../lib/taskQueryParser.ts'
import { IconInbox, IconPlus, IconSparkle } from '../common/Icon.tsx'

interface Props {
  projects: Project[]
  areas: Area[]
  onCapture: (rawText: string) => Promise<void>
  onCreateTask: (input: TaskSaveInput) => Promise<void>
  onOpenStructured: () => void
  onSearchChange: (query: ParsedQuery | null) => void
}

function matchByName<T extends { id: string; name: string }>(items: T[], needle: string | undefined): T | null {
  if (!needle) return null
  const lower = needle.toLowerCase()
  return items.find(it => it.name.toLowerCase() === lower)
    ?? items.find(it => it.name.toLowerCase().includes(lower))
    ?? null
}

export function QuickAdd({ projects, areas, onCapture, onCreateTask, onOpenStructured, onSearchChange }: Props) {
  const [value, setValue] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const parsed = useMemo<ParsedTask | null>(() => {
    if (!value.trim()) return null
    return parseInput(value)
  }, [value])

  const matchedProject = useMemo(() => matchByName(projects, parsed?.projectName), [projects, parsed?.projectName])
  const matchedArea = useMemo(() => matchByName(areas, parsed?.areaName), [areas, parsed?.areaName])

  const structured = parsed != null && hasStructure(parsed)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    setError('')
    try {
      if (parsed && structured) {
        const input: TaskSaveInput = {
          title: parsed.title || trimmed,
          notes: '',
          status: parsed.status ?? 'next',
          priority: parsed.priority,
          projectId: matchedProject?.id ?? (projects[0]?.id ?? ''),
          tags: parsed.tags,
          dependsOn: [],
        }
        if (!input.projectId) {
          setError('Crie um projeto primeiro pra usar captura estruturada')
          return
        }
        if (matchedArea) input.areaId = matchedArea.id
        if (parsed.dueAt) input.dueAt = parsed.dueAt
        await onCreateTask(input)
        setValue('')
        setToast(`✓ tarefa criada${matchedProject ? ` em ${matchedProject.name}` : ''}`)
      } else {
        await onCapture(trimmed)
        setValue('')
        setToast('→ Inbox')
      }
      setTimeout(() => setToast(''), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao capturar')
    } finally {
      setSaving(false)
    }
  }

  const handleSearchChange = (next: string) => {
    setSearch(next)
    const trimmed = next.trim()
    if (!trimmed) {
      onSearchChange(null)
      return
    }
    const q = parseQuery(trimmed)
    onSearchChange(hasFilter(q) ? q : null)
  }

  const handleSearchClear = () => {
    setSearch('')
    onSearchChange(null)
  }

  return (
    <div className="quick-add">
      <form onSubmit={e => { void handleSubmit(e) }} className="quick-add-form">
        <span className="quick-add-icon">
          {structured ? <IconSparkle size={14} /> : <IconInbox size={16} />}
        </span>
        <input
          className="quick-add-input"
          placeholder={structured ? 'criar tarefa estruturada…' : 'capturar pra inbox…'}
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={saving}
          autoComplete="off"
        />
        <button
          type="button"
          className="quick-add-structured-btn"
          onClick={onOpenStructured}
          aria-label="Nova tarefa estruturada"
        >
          <IconPlus size={12} /> tarefa
        </button>
      </form>

      {parsed && structured && (
        <div className="quick-add-preview">
          {parsed.dueDate && (
            <span className="quick-add-chip">
              {parsed.dueAt
                ? new Date(parsed.dueAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : parsed.dueDate}
            </span>
          )}
          {parsed.projectName && (
            <span className={`quick-add-chip${matchedProject ? '' : ' unresolved'}`} title={matchedProject ? 'projeto identificado' : 'projeto não encontrado — vai pro projeto default'}>
              📁 {matchedProject?.name ?? `${parsed.projectName}?`}
            </span>
          )}
          {parsed.areaName && matchedArea && <span className="quick-add-chip">⌂ {matchedArea.name}</span>}
          {parsed.priority !== 'med' && <span className="quick-add-chip">{parsed.priority === 'high' ? '!alta' : '!baixa'}</span>}
          {parsed.status && parsed.status !== 'next' && <span className="quick-add-chip">{parsed.status}</span>}
          {parsed.tags.map(t => <span key={t} className="quick-add-chip">#{t}</span>)}
        </div>
      )}

      {toast && <div className="quick-add-toast">{toast}</div>}
      {error && <div className="quick-add-error">{error}</div>}

      <form
        className="quick-add-search"
        onSubmit={e => { e.preventDefault() }}
      >
        <span className="quick-add-icon">🔍</span>
        <input
          className="quick-add-input"
          placeholder="buscar (ex: vencimento entre 20 e 27/05, projeto STATE)"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          autoComplete="off"
        />
        {search && (
          <button
            type="button"
            className="quick-add-structured-btn"
            onClick={handleSearchClear}
            aria-label="Limpar busca"
          >
            ×
          </button>
        )}
      </form>
    </div>
  )
}
