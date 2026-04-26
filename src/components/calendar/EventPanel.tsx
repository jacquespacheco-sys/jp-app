import { useState, useEffect } from 'react'
import type { CalendarEvent, Calendar } from '../../types/domain.ts'
import type { EventSaveInput } from '../../../api/_schemas/event.ts'

interface Props {
  event: CalendarEvent | null
  calendars: Calendar[]
  onSave: (input: EventSaveInput) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onClose: () => void
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toISO(local: string): string {
  return new Date(local).toISOString()
}

export function EventPanel({ event, calendars, onSave, onDelete, onClose }: Props) {
  const defaultCalendar = calendars.find(c => c.isDefaultForCreate) ?? calendars[0]
  const [summary, setSummary] = useState(event?.summary ?? '')
  const [startAt, setStartAt] = useState(event ? toLocalDatetime(event.startAt) : '')
  const [endAt, setEndAt] = useState(event ? toLocalDatetime(event.endAt) : '')
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [calendarId, setCalendarId] = useState(event?.calendarId ?? defaultCalendar?.id ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSummary(event?.summary ?? '')
    setStartAt(event ? toLocalDatetime(event.startAt) : '')
    setEndAt(event ? toLocalDatetime(event.endAt) : '')
    setAllDay(event?.allDay ?? false)
    setCalendarId(event?.calendarId ?? defaultCalendar?.id ?? '')
    setDescription(event?.description ?? '')
    setLocation(event?.location ?? '')
  }, [event, defaultCalendar?.id])

  if (!defaultCalendar) return null

  const handleSave = async () => {
    if (!summary.trim() || !startAt || !endAt || !calendarId) return
    setSaving(true)
    try {
      await onSave({
        id: event?.id,
        calendarId,
        summary: summary.trim(),
        description: description || undefined,
        location: location || undefined,
        startAt: toISO(startAt),
        endAt: toISO(endAt),
        allDay,
        status: 'confirmed',
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="task-panel-overlay" onClick={onClose}>
      <div className="task-panel" onClick={e => e.stopPropagation()}>
        <div className="task-panel-header">
          <span className="task-panel-label">{event ? 'Evento' : 'Novo Evento'}</span>
          <button className="task-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="task-panel-body">
          <textarea
            className="task-panel-title-input"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={2}
            placeholder="Título do evento"
          />

          <div className="task-field">
            <span className="task-field-label">Calendário</span>
            <select className="task-field-select" value={calendarId} onChange={e => setCalendarId(e.target.value)}>
              {calendars.map(c => <option key={c.id} value={c.id}>{c.summary}</option>)}
            </select>
          </div>

          <div className="task-field">
            <span className="task-field-label">Dia inteiro</span>
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
          </div>

          <div className="task-field">
            <span className="task-field-label">Início</span>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              className="task-field-input"
              value={allDay ? startAt.slice(0, 10) : startAt}
              onChange={e => setStartAt(allDay ? `${e.target.value}T00:00` : e.target.value)}
            />
          </div>

          <div className="task-field">
            <span className="task-field-label">Fim</span>
            <input
              type={allDay ? 'date' : 'datetime-local'}
              className="task-field-input"
              value={allDay ? endAt.slice(0, 10) : endAt}
              onChange={e => setEndAt(allDay ? `${e.target.value}T23:59` : e.target.value)}
            />
          </div>

          <div className="task-field">
            <span className="task-field-label">Local</span>
            <input className="task-field-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Endereço ou link" />
          </div>

          <span className="task-panel-notes-label">Descrição</span>
          <textarea className="task-panel-notes" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes…" />
        </div>

        <div className="task-panel-actions">
          {event?.id && onDelete && (
            <button className="btn btn-ghost" style={{ borderColor: 'var(--border)' }} onClick={() => { void onDelete(event.id).then(onClose) }} disabled={saving}>
              Excluir
            </button>
          )}
          <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { void handleSave() }} disabled={saving || !summary.trim()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
