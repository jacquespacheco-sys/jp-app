import { format, addDays, startOfWeek, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CalendarEvent, Calendar } from '../../types/domain.ts'

const HOUR_H = 60 // px per hour
const TOTAL_H = 24 * HOUR_H

interface Props {
  date: Date
  events: CalendarEvent[]
  calendars: Calendar[]
  onOpen: (event: CalendarEvent) => void
}

function calendarColor(calendars: Calendar[], calendarId: string): string {
  return calendars.find(c => c.id === calendarId)?.customColor ?? '#616161'
}

function textOnColor(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return '#ffffff'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#0a0a0a' : '#ffffff'
}

function eventTop(startAt: string): number {
  const d = parseISO(startAt)
  return (d.getHours() + d.getMinutes() / 60) * HOUR_H
}

function eventHeight(startAt: string, endAt: string): number {
  const start = parseISO(startAt)
  const end = parseISO(endAt)
  const diffMins = (end.getTime() - start.getTime()) / 60000
  return Math.max((diffMins / 60) * HOUR_H, 20)
}

export function WeekView({ date, events, calendars, onOpen }: Props) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

  const eventsForDay = (d: Date) =>
    events.filter(ev => !ev.allDay && ev.startAt.slice(0, 10) === dayKey(d))

  const allDayEvents = (d: Date) =>
    events.filter(ev => ev.allDay && ev.startAt.slice(0, 10) === dayKey(d))

  return (
    <div>
      {/* All-day strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ borderRight: '1px solid var(--border)' }} />
        {days.map(d => (
          <div key={dayKey(d)} className={`cal-day-header${isToday(d) ? ' today' : ''}`}>
            <div>{format(d, 'EEE', { locale: ptBR })}</div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>{format(d, 'd')}</div>
            {allDayEvents(d).map(ev => {
              const isTask = ev.source === 'task_block'
              return (
                <div
                  key={ev.id}
                  className="cal-month-event"
                  style={{
                    borderLeftColor: isTask ? 'var(--accent)' : calendarColor(calendars, ev.calendarId),
                    background: isTask ? 'var(--accent)' : undefined,
                    color: isTask ? 'var(--accent-ink)' : undefined,
                    cursor: isTask ? 'default' : 'pointer',
                  }}
                  onClick={() => onOpen(ev)}
                >
                  {isTask ? '✓ ' : ''}{ev.summary}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="cal-grid-wrapper">
        <div className="cal-grid cal-week-grid" style={{ height: TOTAL_H }}>
          {/* Time labels */}
          <div className="cal-time-col" style={{ height: TOTAL_H }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="cal-hour-label" style={{ top: h * HOUR_H }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(d => (
            <div key={dayKey(d)} className="cal-day-col">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="cal-hour-line" style={{ top: h * HOUR_H }} />
              ))}
              {eventsForDay(d).map(ev => {
                const bg = calendarColor(calendars, ev.calendarId)
                return (
                <div
                  key={ev.id}
                  className="cal-event-block"
                  style={{
                    top: eventTop(ev.startAt),
                    height: eventHeight(ev.startAt, ev.endAt),
                    background: bg,
                    color: textOnColor(bg),
                  }}
                  onClick={() => onOpen(ev)}
                >
                  {format(parseISO(ev.startAt), 'HH:mm')} {ev.summary}
                </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
