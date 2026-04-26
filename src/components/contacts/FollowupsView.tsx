import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Contact } from '../../types/domain.ts'
import { ContactRow } from './ContactRow.tsx'

interface Props {
  contacts: Contact[]
  onOpen: (contact: Contact) => void
}

function urgencyLabel(nextContact: string): { label: string; color: string } {
  try {
    const d = parseISO(nextContact)
    if (isPast(d) && !isToday(d)) return { label: 'Atrasado', color: 'var(--danger)' }
    if (isToday(d)) return { label: 'Hoje', color: 'var(--accent)' }
    const days = differenceInDays(d, new Date())
    if (days <= 3) return { label: `Em ${days}d`, color: 'var(--fg-muted)' }
    return { label: format(d, 'd MMM', { locale: ptBR }), color: 'var(--fg-dim)' }
  } catch {
    return { label: '', color: 'var(--fg-dim)' }
  }
}

export function FollowupsView({ contacts, onOpen }: Props) {
  const withFollowup = contacts
    .filter(c => c.nextContact)
    .sort((a, b) => {
      try {
        return parseISO(a.nextContact!).getTime() - parseISO(b.nextContact!).getTime()
      } catch { return 0 }
    })

  if (withFollowup.length === 0) {
    return <div className="empty-state content">Nenhum follow-up agendado</div>
  }

  return (
    <div className="content" style={{ paddingTop: '8px' }}>
      {withFollowup.map(c => {
        const { label, color } = urgencyLabel(c.nextContact!)
        return (
          <div key={c.id} style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'Space Mono, monospace', fontSize: '9px', letterSpacing: '1px',
              color, textTransform: 'uppercase',
            }}>
              {label}
            </div>
            <ContactRow contact={c} onClick={() => onOpen(c)} />
          </div>
        )
      })}
    </div>
  )
}
