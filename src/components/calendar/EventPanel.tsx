import { useState, useEffect } from 'react'
import type { CalendarEvent, Calendar } from '../../types/domain.ts'
import type { EventSaveInput } from '../../../api/_schemas/event.ts'

interface Prefill {
  summary?: string
  startAt?: string
  endAt?: string
  allDay?: boolean
  location?: string
  description?: string
}

interface Props {
  event: CalendarEvent | null
  prefill?: Prefill
  calendars: Calendar[]
  onSave: (input: EventSaveInput) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onClose: () => void
}

const DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1h', value: 60 },
  { label: '1h 30', value: 90 },
  { label: '2h', value: 120 },
  { label: '3h', value: 180 },
]

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toISO(local: string): string {
  return new Date(local).toISOString()
}

function calcDurationMins(startIso: string, endIso: string): number {
  const diff = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  const vals = DURATIONS.map(d => d.value)
  if (vals.includes(diff)) return diff
  return vals.reduce((a, b) => Math.abs(b - diff) < Math.abs(a - diff) ? b : a)
}

export function EventPanel({ event, prefill, calendars, onSave, onDelete, onClose }: Props) {
  const defaultCalendar = calendars.find(c => c.isDefaultForCreate) ?? calendars[0]

  const [summary, setSummary] = useState('')
  const [startAt, setStartAt] = useState('')
  const [durationMins, setDurationMins] = useState(30)
  const [allDay, setAllDay] = useState(false)
  const [calendarId, setCalendarId] = useState(defaultCalendar?.id ?? '')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const s = event?.startAt ?? prefill?.startAt
    const e = event?.endAt ?? prefill?.endAt
    setSummary(event?.summary ?? prefill?.summary ?? '')
    setStartAt(s ? toLocalDatetime(s) : '')
    setAllDay(event?.allDay ?? prefill?.allDay ?? false)
    setCalendarId(event?.calendarId ?? defaultCalendar?.id ?? '')
    setDescription(event?.description ?? prefill?.description ?? '')
    setLocation(event?.location ?? prefill?.location ?? '')
    setDurationMins(s && e ? calcDurationMins(s, e) : 30)
  }, [event, prefill, defaultCalendar?.id])

  if (!defaultCalendar) return null

  const handleSave = async () => {
    if (!summary.trim() || !startAt || !calendarId) return
    setSaving(true)
    try {
      let endAt: string
      if (allDay) {
        endAt = toISO(`${startAt.slice(0, 10)}T23:59`)
      } else {
        const startMs = new Date(toISO(startAt)).getTime()
        endAt = new Date(startMs + durationMins * 60000).toISOString()
      }
      await onSave({
        id: event?.id,
        calendarId,
        summary: summary.trim(),
        description: description || undefined,
        location: location || undefined,
        startAt: toISO(startAt),
        endAt,
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
            autoFocus
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

          {!allDay && (
            <div className="task-field">
              <span className="task-field-label">Duração</span>
              <select
                className="task-field-select"
                value={durationMins}
                onChange={e => setDurationMins(Number(e.target.value))}
              >
                {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          )}

          <div className="task-field">
            <span className="task-field-label">Local</span>
            <input
              className="task-field-input"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Endereço ou link"
            />
          </div>

          <span className="task-panel-notes-label">Descrição</span>
          <textarea
            className="task-panel-notes"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detalhes…"
          />
        </div>

        <div className="task-panel-actions">
          {event?.id && onDelete && (
            <button
              className="btn btn-ghost"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => { void onDelete(event.id).then(onClose) }}
              disabled={saving}
            >
              Excluir
            </button>
          )}
          <button
            className="btn btn-accent"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => { void handleSave() }}
            disabled={saving || !summary.trim()}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
