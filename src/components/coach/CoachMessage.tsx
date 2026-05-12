import { format } from 'date-fns'
import type { CoachLogEntry } from '../../types/domain.ts'

function stripMarker(text: string): string {
  return text.replace(/^<!--\s*(morning|evening|weekly)\s*-->\n?/, '')
}

export function CoachMessage({ entry, streaming }: {
  entry: CoachLogEntry
  streaming?: boolean
}) {
  const time = format(new Date(entry.createdAt), 'HH:mm')
  const isUser = entry.direction === 'user_to_coach'
  const text = isUser ? entry.contentMd : stripMarker(entry.contentMd)
  const label = isUser ? 'você' : 'coach'

  return (
    <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        fontFamily: 'Space Mono, monospace',
        fontSize: '9px',
        letterSpacing: '1px',
        color: 'var(--fg-dim)',
        marginBottom: '4px',
        textTransform: 'uppercase',
      }}>
        {label} · {time}
        {entry.kind === 'check_in' && ' · check-in'}
      </div>
      <div style={{
        maxWidth: '85%',
        padding: isUser ? '8px 12px' : '0',
        background: isUser ? 'var(--bg-secondary)' : 'transparent',
        borderRadius: isUser ? '12px 12px 4px 12px' : '0',
        color: 'var(--fg)',
        fontSize: '14px',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {text}
        {streaming && (
          <span style={{ display: 'inline-block', marginLeft: '4px', color: 'var(--accent)', animation: 'pulse 1s infinite' }}>▶</span>
        )}
      </div>
    </div>
  )
}
