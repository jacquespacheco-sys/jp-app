import { useState, useEffect } from 'react'
import type { Note, NoteTag, NoteFolder } from '../../types/domain.ts'
import type { NoteSaveInput } from '../../../api/_schemas/note.ts'
import { NoteEditor } from './NoteEditor.tsx'
import { AudioRecorder } from './AudioRecorder.tsx'
import { api } from '../../api.ts'

interface Props {
  note?: Note | null
  initialType?: Note['type']
  tags: NoteTag[]
  folders: NoteFolder[]
  onSave: (input: NoteSaveInput) => Promise<Note>
  onDelete?: (id: string) => Promise<void>
  onClose: () => void
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function NotePanel({ note, initialType, tags, folders, onSave, onDelete, onClose }: Props) {
  const [type, setType] = useState<Note['type']>(note?.type ?? initialType ?? 'text')
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [url, setUrl] = useState(note?.url ?? '')
  const [selectedTags, setSelectedTags] = useState<string[]>(note?.tagIds ?? [])
  const [folderId, setFolderId] = useState<string>(note?.folderId ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [audioUrl, setAudioUrl] = useState(note?.url ?? '')
  const [audioDuration, setAudioDuration] = useState(note?.audioDuration ?? 0)
  const [tempId] = useState(() => crypto.randomUUID())

  useEffect(() => {
    if (note) {
      setType(note.type)
      setTitle(note.title ?? '')
      setContent(note.content)
      setUrl(note.url ?? '')
      setSelectedTags(note.tagIds)
      setFolderId(note.folderId ?? '')
      setAudioUrl(note.url ?? '')
      setAudioDuration(note.audioDuration ?? 0)
    }
  }, [note])

  const handleAudioRecorded = async (blob: Blob, duration: number) => {
    const noteId = note?.id ?? tempId
    setUploading(true)
    try {
      const base64 = await blobToBase64(blob)
      const res = await api.post<{ url: string }>('/api/notes-upload', { noteId, base64, contentType: 'audio/webm' })
      setAudioUrl(res.url)
      setAudioDuration(duration)
      setContent(res.url)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (type === 'postit' && !content.trim()) return
    if (type === 'text' && !content.trim()) return
    if (type === 'audio' && !audioUrl) return
    if (type === 'link' && !url.trim()) return
    setSaving(true)
    try {
      const input: NoteSaveInput = {
        type,
        content: type === 'link' ? (title || url) : content,
        tagIds: selectedTags,
        ...(note?.id ? { id: note.id } : {}),
        ...(folderId ? { folderId } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(type === 'link' ? { url: url.trim() } : {}),
        ...(type === 'audio' ? { url: audioUrl, audioDuration } : {}),
      }
      await onSave(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (id: string) => {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  return (
    <div className="task-panel-overlay" onClick={onClose}>
      <div className="task-panel note-panel" onClick={e => e.stopPropagation()}>
        <div className="task-panel-header">
          <span className="task-panel-label">{note ? 'Editar nota' : 'Nova nota'}</span>
          <button className="task-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="task-panel-body">
          {!note && (
            <div className="note-type-tabs">
              {(['postit', 'text', 'audio', 'link'] as const).map(t => (
                <button key={t} className={`note-type-tab${type === t ? ' active' : ''}`} onClick={() => setType(t)}>
                  {t === 'postit' ? 'Post-it' : t === 'text' ? 'Texto' : t === 'audio' ? 'Áudio' : 'Link'}
                </button>
              ))}
            </div>
          )}

          {(type === 'text' || type === 'postit') && (
            <input
              className="task-field-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título (opcional)"
              style={{ marginBottom: '8px', width: '100%' }}
            />
          )}

          {type === 'postit' && (
            <textarea
              className="task-panel-notes"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Anote algo rápido…"
              rows={5}
              autoFocus
            />
          )}

          {type === 'text' && (
            <NoteEditor
              content={content}
              onChange={setContent}
              placeholder="Escreva aqui…"
            />
          )}

          {type === 'audio' && (
            <div style={{ padding: '16px 0' }}>
              {audioUrl ? (
                <div className="audio-preview">
                  <audio controls src={audioUrl} style={{ width: '100%' }} />
                  <button className="btn btn-ghost" style={{ marginTop: '8px', fontSize: '11px' }} onClick={() => { setAudioUrl(''); setContent(''); setAudioDuration(0) }}>
                    Regravar
                  </button>
                </div>
              ) : (
                <AudioRecorder onRecorded={(blob, dur) => void handleAudioRecorded(blob, dur)} />
              )}
              {uploading && <div className="empty-state" style={{ paddingTop: '8px', fontSize: '11px' }}>Enviando…</div>}
            </div>
          )}

          {type === 'link' && (
            <>
              <input
                className="task-field-input"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
                type="url"
                autoFocus
                style={{ marginBottom: '8px', width: '100%' }}
              />
              <input
                className="task-field-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título (opcional)"
                style={{ width: '100%' }}
              />
            </>
          )}

          <div className="task-field" style={{ marginTop: '12px' }}>
            <span className="task-field-label">Pasta</span>
            <select className="task-field-select" value={folderId} onChange={e => setFolderId(e.target.value)}>
              <option value="">Sem pasta</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          {tags.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <span className="task-field-label" style={{ display: 'block', marginBottom: '8px' }}>Tags</span>
              <div className="note-tag-picker">
                {tags.map(t => (
                  <button
                    key={t.id}
                    className={`note-tag${selectedTags.includes(t.id) ? ' selected' : ''}`}
                    style={{ background: selectedTags.includes(t.id) ? t.color + '33' : undefined, color: t.color, borderColor: t.color + '55' }}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="task-panel-actions">
          {note?.id && onDelete && (
            <button className="btn btn-ghost" style={{ borderColor: 'var(--border)' }} onClick={() => { void onDelete(note.id).then(onClose) }} disabled={saving}>Excluir</button>
          )}
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => void handleSave()}
            disabled={saving || uploading}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
