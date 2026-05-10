import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Note, NoteTag } from '../../types/domain.ts'

interface Props {
  note: Note
  tags: NoteTag[]
  onOpen: (note: Note) => void
  onTogglePin: (note: Note) => void
}

function typeLabel(type: Note['type']) {
  if (type === 'postit') return 'post-it'
  if (type === 'audio') return 'áudio'
  if (type === 'link') return 'link'
  return 'texto'
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function NoteCard({ note, tags, onOpen, onTogglePin }: Props) {
  const noteTags = tags.filter(t => note.tagIds.includes(t.id))
  const preview = note.type === 'text' ? stripHtml(note.content) : note.content

  return (
    <div className={`note-card note-card-${note.type}${note.pinned ? ' pinned' : ''}`} onClick={() => onOpen(note)}>
      <div className="note-card-header">
        <span className="note-card-type">{typeLabel(note.type)}</span>
        <button
          className={`note-pin-btn${note.pinned ? ' active' : ''}`}
          onClick={e => { e.stopPropagation(); onTogglePin(note) }}
          title={note.pinned ? 'Desafixar' : 'Fixar'}
        >
          ⊕
        </button>
      </div>
      {note.title && <div className="note-card-title">{note.title}</div>}
      {preview && <div className="note-card-preview">{preview.slice(0, 140)}{preview.length > 140 ? '…' : ''}</div>}
      {note.type === 'audio' && note.audioDuration !== undefined && (
        <div className="note-card-audio">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/></svg>
          {Math.floor(note.audioDuration / 60)}:{String(note.audioDuration % 60).padStart(2, '0')}
        </div>
      )}
      {note.type === 'link' && note.thumbnailUrl && (
        <img src={note.thumbnailUrl} alt="" className="note-card-thumb" />
      )}
      <div className="note-card-footer">
        <span className="note-card-date">{format(new Date(note.createdAt), "d MMM", { locale: ptBR })}</span>
        <div className="note-card-tags">
          {noteTags.map(t => (
            <span key={t.id} className="note-tag" style={{ background: t.color + '22', color: t.color, borderColor: t.color + '44' }}>{t.name}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
