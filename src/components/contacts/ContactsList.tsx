import type { Contact } from '../../types/domain.ts'
import { ContactRow } from './ContactRow.tsx'

interface Props {
  contacts: Contact[]
  onOpen: (contact: Contact) => void
  onNew: () => void
}

export function ContactsList({ contacts, onOpen, onNew }: Props) {
  if (contacts.length === 0) {
    return (
      <div className="content">
        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <span>Nenhum contato ainda</span>
          <button className="btn btn-accent" style={{ fontSize: '10px' }} onClick={onNew}>+ Novo contato</button>
        </div>
      </div>
    )
  }

  return (
    <div className="content" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
      {contacts.map(c => (
        <ContactRow key={c.id} contact={c} onClick={() => onOpen(c)} />
      ))}
    </div>
  )
}
