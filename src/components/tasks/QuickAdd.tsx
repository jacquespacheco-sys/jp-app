import { useState, type FormEvent } from 'react'

interface Props {
  onCapture: (rawText: string) => Promise<void>
  onOpenStructured: () => void
}

export function QuickAdd({ onCapture, onOpenStructured }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    setError('')
    try {
      await onCapture(trimmed)
      setValue('')
      setToast('→ Inbox')
      setTimeout(() => setToast(''), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao capturar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="quick-add">
      <form onSubmit={e => { void handleSubmit(e) }} className="quick-add-form">
        <input
          className="quick-add-input"
          placeholder="📥 capturar pra inbox…"
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
          + tarefa
        </button>
      </form>
      {toast && <div className="quick-add-toast">{toast}</div>}
      {error && <div className="quick-add-error">{error}</div>}
      <div className="quick-add-hints">
        <span>↵ vai pra Inbox · organiza depois</span>
        <span>+ tarefa abre formulário completo</span>
      </div>
    </div>
  )
}
