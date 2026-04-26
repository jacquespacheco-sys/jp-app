import { format, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CalendarEvent, Calendar } from '../../types/domain.ts'

interface Props {
  events: CalendarEvent[]
  calendars: Calendar[]
  onOpen: (event: CalendarEvent) => void
}

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const day = ev.startAt.slice(0, 10)
    const arr = map.get(day)
    if (arr) arr.push(ev)
    else map.set(day, [ev])
  }
  return map
}

function calendarColor(calendars: Calendar[], calendarId: string): string {
  return calendars.find(c => c.id === calendarId)?.customColor ?? '#616161'
}

export function AgendaView({ events, calendars, onOpen }: Props) {
  if (events.length === 0) {
    return <div className="empty-state">Nenhum evento neste período</div>
  }

  const grouped = groupByDay(events)
  const days = [...grouped.keys()].sort()

  return (
    <div className="content">
      {days.map(day => {
        const dayEvents = grouped.get(day) ?? []
        const date = parseISO(day)
        const todayClass = isToday(date) ? ' today' : ''

        return (
          <div key={day} className="agenda-group">
            <div className={`agenda-day-header${todayClass}`}>
              <span>{format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
              {isToday(date) && <span style={{ fontSize: '9px', background: 'var(--accent)', color: 'var(--accent-ink)', padding: '2px 6px' }}>HOJE</span>}
            </div>
            {dayEvents.map(ev => (
              <div key={ev.id} className="agenda-event" onClick={() => onOpen(ev)}>
                <div className="agenda-event-time">
                  {ev.allDay ? 'dia todo' : format(parseISO(ev.startAt), 'HH:mm')}
                </div>
                <div
                  className="agenda-event-dot"
                  style={{ background: calendarColor(calendars, ev.calendarId) }}
                />
                <div>
                  <div className="agenda-event-title">{ev.summary}</div>
                  {ev.location && <div className="agenda-event-sub">{ev.location}</div>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
