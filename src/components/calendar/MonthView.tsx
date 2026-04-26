import { format, startOfMonth, endOfMonth, startOfWeek, addDays, isSameMonth, isToday, parseISO } from 'date-fns'
import type { CalendarEvent, Calendar } from '../../types/domain.ts'

interface Props {
  date: Date
  events: CalendarEvent[]
  calendars: Calendar[]
  onOpen: (event: CalendarEvent) => void
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function calendarColor(calendars: Calendar[], calendarId: string): string {
  return calendars.find(c => c.id === calendarId)?.customColor ?? '#616161'
}

export function MonthView({ date, events, calendars, onOpen }: Props) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })

  const cells: Date[] = []
  let cur = gridStart
  while (cur <= monthEnd || cells.length % 7 !== 0) {
    cells.push(cur)
    cur = addDays(cur, 1)
    if (cells.length > 42) break
  }

  const eventsForDay = (d: Date) => {
    const key = format(d, 'yyyy-MM-dd')
    return events.filter(ev => ev.startAt.slice(0, 10) === key)
  }

  return (
    <div className="cal-month">
      <div className="cal-month-header">
        {DAYS.map(d => <div key={d} className="cal-month-dow">{d}</div>)}
      </div>
      <div className="cal-month-grid">
        {cells.map((d, i) => {
          const dayEvents = eventsForDay(d)
          const inMonth = isSameMonth(d, date)
          return (
            <div key={i} className="cal-month-cell">
              <div className={`cal-month-day${isToday(d) ? ' today' : ''}${!inMonth ? ' other-month' : ''}`}>
                {format(d, 'd')}
              </div>
              {dayEvents.slice(0, 3).map(ev => {
                const color = calendarColor(calendars, ev.calendarId)
                return (
                <div
                  key={ev.id}
                  className="cal-month-event"
                  style={{ borderLeftColor: color, background: `${color}18` }}
                  onClick={() => onOpen(ev)}
                >
                  {!ev.allDay && <span style={{ opacity: 0.7 }}>{format(parseISO(ev.startAt), 'HH:mm')} </span>}
                  {ev.summary}
                </div>
                )
              })}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: '9px', color: 'var(--fg-dim)', fontFamily: 'Space Mono, monospace', padding: '0 2px' }}>
                  +{dayEvents.length - 3}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
