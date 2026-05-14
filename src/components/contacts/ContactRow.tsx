import type { Contact, Category } from '../../types/domain.ts'
import { CategoryChip } from '../shared/CategoryChip.tsx'

interface Props {
  contact: Contact
  onClick: () => void
}

const PHASE_LABEL: Record<string, string> = {
  prospect: 'Prospect', first: '1º Contato', talking: 'Conversando',
  proposal: 'Proposta', active: 'Ativo', dormant: 'Adormecido',
}

const DIM_PRIORITY: Record<string, number> = {
  aproximacao: 0, perfil: 1, assunto: 2,
}

function initials(c: Contact): string {
  return `${c.firstName[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase()
}

function prioritizedCategories(cats: Category[] | undefined): { visible: Category[]; overflow: number } {
  if (!cats || cats.length === 0) return { visible: [], overflow: 0 }
  const sorted = [...cats].sort((a, b) => {
    const ap = DIM_PRIORITY[a.dimensionSlug ?? ''] ?? 99
    const bp = DIM_PRIORITY[b.dimensionSlug ?? ''] ?? 99
    return ap - bp
  })
  return {
    visible: sorted.slice(0, 3),
    overflow: Math.max(0, sorted.length - 3),
  }
}

export function ContactRow({ contact, onClick }: Props) {
  const { visible, overflow } = prioritizedCategories(contact.categories)

  return (
    <div className="contact-row" onClick={onClick}>
      <div className="contact-avatar">
        {initials(contact)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="contact-name">{contact.firstName} {contact.lastName}</div>
        <div className="contact-sub">
          {[contact.role, contact.company].filter(Boolean).join(' · ')}
        </div>
        {visible.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {visible.map(c => <CategoryChip key={c.id} category={c} size="sm" />)}
            {overflow > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px',
                color: 'var(--fg-dim)', letterSpacing: '1px',
                padding: '2px 6px', alignSelf: 'center',
              }}>
                +{overflow}
              </span>
            )}
          </div>
        )}
      </div>
      {contact.phase && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '9px',
          letterSpacing: '1px', padding: '3px 7px', border: '1px solid var(--border)',
          color: 'var(--fg-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          {PHASE_LABEL[contact.phase] ?? contact.phase}
        </div>
      )}
    </div>
  )
}
