import { useState } from 'react'
import type { NoteTag } from '../../types/domain.ts'

const PRESET_COLORS = ['#7dd3fc', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f9ca24', '#f472b6', '#34d399', '#fb923c', '#94a3b8', '#5eead4']

interface Props {
  tags: NoteTag[]
  onSave: (input: { id?: string; name: string; color: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function TagManager({ tags, onSave, onDelete }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0] ?? '#7dd3fc')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const startEdit = (tag: NoteTag) => {
    setEditingId(tag.id)
    setName(tag.name)
    setColor(tag.color)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ ...(editingId ? { id: editingId } : {}), name: name.trim(), color })
      setName(''); setColor(PRESET_COLORS[0] ?? '#7dd3fc'); setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tag-manager">
      <div className="tag-manager-list">
        {tags.map(t => (
          <div key={t.id} className="tag-manager-row">
            <span className="note-tag" style={{ background: t.color + '22', color: t.color, borderColor: t.color + '44' }}>{t.name}</span>
            <button className="icon-btn" onClick={() => startEdit(t)} title="Editar" style={{ width: 24, height: 24 }}>
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button className="icon-btn" onClick={() => void onDelete(t.id)} title="Excluir" style={{ width: 24, height: 24 }}>
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        ))}
      </div>

      <div className="tag-manager-form">
        <input
          className="task-field-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome da tag"
          style={{ flex: 1 }}
          onKeyDown={e => { if (e.key === 'Enter') void handleSave() }}
        />
        <div className="color-picker">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              className={`color-dot${color === c ? ' selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button className="btn btn-accent" style={{ fontSize: '11px', padding: '6px 14px' }} onClick={() => void handleSave()} disabled={saving || !name.trim()}>
          {editingId ? 'Salvar' : 'Criar'}
        </button>
        {editingId && (
          <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '6px 10px' }} onClick={() => { setEditingId(null); setName(''); setColor(PRESET_COLORS[0] ?? '#7dd3fc') }}>×</button>
        )}
      </div>
    </div>
  )
}
