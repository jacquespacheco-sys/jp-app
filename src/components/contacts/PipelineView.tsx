import type { Contact } from '../../types/domain.ts'
import { ContactRow } from './ContactRow.tsx'

interface Props {
  contacts: Contact[]
  onOpen: (contact: Contact) => void
}

const STAGES = [
  { key: 'prospect', label: 'Prospect' },
  { key: 'first', label: '1º Contato' },
  { key: 'talking', label: 'Conversando' },
  { key: 'proposal', label: 'Proposta' },
  { key: 'active', label: 'Ativo' },
  { key: 'dormant', label: 'Adormecido' },
]

export function PipelineView({ contacts, onOpen }: Props) {
  const noPhase = contacts.filter(c => !c.phase)
  const byStage = (key: string) => contacts.filter(c => c.phase === key)

  const renderGroup = (label: string, group: Contact[]) => {
    if (group.length === 0) return null
    return (
      <div key={label} className="task-group">
        <div className="task-group-title">
          {label}
          <span className="task-group-count">{group.length}</span>
        </div>
        {group.map(c => <ContactRow key={c.id} contact={c} onClick={() => onOpen(c)} />)}
      </div>
    )
  }

  return (
    <div className="content">
      {STAGES.map(s => renderGroup(s.label, byStage(s.key)))}
      {renderGroup('Sem fase', noPhase)}
      {contacts.length === 0 && (
        <div className="empty-state">Nenhum contato no pipeline</div>
      )}
    </div>
  )
}
