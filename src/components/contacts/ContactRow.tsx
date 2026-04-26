import type { Contact } from '../../types/domain.ts'

interface Props {
  contact: Contact
  onClick: () => void
}

const PHASE_LABEL: Record<string, string> = {
  prospect: 'Prospect', first: '1º Contato', talking: 'Conversando',
  proposal: 'Proposta', active: 'Ativo', dormant: 'Adormecido',
}

function initials(c: Contact): string {
  return `${c.firstName[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase()
}

export function ContactRow({ contact, onClick }: Props) {
  return (
    <div className="contact-row" onClick={onClick}>
      <div className="contact-avatar">
        {initials(contact)}
      </div>
      <div>
        <div className="contact-name">{contact.firstName} {contact.lastName}</div>
        <div className="contact-sub">
          {[contact.role, contact.company].filter(Boolean).join(' · ')}
        </div>
      </div>
      {contact.phase && (
        <div style={{
          fontFamily: 'Space Mono, monospace', fontSize: '9px',
          letterSpacing: '1px', padding: '3px 7px', border: '1px solid var(--border)',
          color: 'var(--fg-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          {PHASE_LABEL[contact.phase] ?? contact.phase}
        </div>
      )}
    </div>
  )
}
