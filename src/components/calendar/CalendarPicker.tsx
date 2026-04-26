import { api } from '../../api.ts'
import type { Calendar } from '../../types/domain.ts'

interface Props {
  calendars: Calendar[]
  onToggle: (id: string, visible: boolean) => void
}

export function CalendarPicker({ calendars, onToggle }: Props) {
  if (calendars.length === 0) return null

  const handleToggle = async (cal: Calendar) => {
    onToggle(cal.id, !cal.isVisible)
    await api.post('/api/calendars-toggle', { id: cal.id, isVisible: !cal.isVisible })
  }

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg)',
      padding: '8px 16px',
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      flexWrap: 'nowrap',
    }}>
      {calendars.map(cal => (
        <button
          key={cal.id}
          onClick={() => { void handleToggle(cal) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            opacity: cal.isVisible ? 1 : 0.4,
            flexShrink: 0,
            maxWidth: '140px',
          }}
        >
          <span style={{
            width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0,
            background: cal.customColor ?? '#616161',
          }} />
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: '9px',
            letterSpacing: '0.5px', color: 'var(--fg-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {cal.summary}
          </span>
        </button>
      ))}
    </div>
  )
}
