import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { api } from '../../api.ts'
import type { Contact, Interaction } from '../../types/domain.ts'
import type { ContactSaveInput } from '../../../api/_schemas/contact.ts'
import type { InteractionsListResponse } from '../../types/api.ts'

interface Props {
  contact: Contact | null
  onSave: (input: ContactSaveInput) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onClose: () => void
}

const PHASES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'first', label: '1º Contato' },
  { value: 'talking', label: 'Conversando' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'active', label: 'Ativo' },
  { value: 'dormant', label: 'Adormecido' },
]

const INTERACTION_TYPES = [
  { value: 'call', label: 'Ligação' },
  { value: 'meeting', label: 'Reunião' },
  { value: 'email', label: 'Email' },
  { value: 'message', label: 'Mensagem' },
]

const TYPE_LABEL: Record<string, string> = {
  call: 'Ligação', meeting: 'Reunião', email: 'Email', message: 'Mensagem',
}

export function ContactPanel({ contact, onSave, onArchive, onClose }: Props) {
  const [firstName, setFirstName] = useState(contact?.firstName ?? '')
  const [lastName, setLastName] = useState(contact?.lastName ?? '')
  const [company, setCompany] = useState(contact?.company ?? '')
  const [role, setRole] = useState(contact?.role ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [birthday, setBirthday] = useState(contact?.birthday ?? '')
  const [phase, setPhase] = useState(contact?.phase ?? '')
  const [nextContact, setNextContact] = useState(contact?.nextContact ?? '')
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [showAddInteraction, setShowAddInteraction] = useState(false)
  const [intType, setIntType] = useState<'call' | 'meeting' | 'email' | 'message'>('call')
  const [intDate, setIntDate] = useState(new Date().toISOString().slice(0, 10))
  const [intNote, setIntNote] = useState('')
  const [savingInt, setSavingInt] = useState(false)

  useEffect(() => {
    if (!contact?.id) return
    void api.get<InteractionsListResponse>(`/api/interactions-list?contactId=${contact.id}`)
      .then(res => setInteractions(res.interactions))
      .catch(() => {})
  }, [contact?.id])

  const handleSave = async () => {
    if (!firstName.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...(contact?.id ? { id: contact.id } : {}),
        firstName: firstName.trim(),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(company.trim() ? { company: company.trim() } : {}),
        ...(role.trim() ? { role: role.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(birthday.trim() ? { birthday: birthday.trim() } : {}),
        ...(phase ? { phase: phase as ContactSaveInput['phase'] } : {}),
        ...(nextContact.trim() ? { nextContact: nextContact.trim() } : {}),
        notes: notes.trim(),
        tags: [],
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleAddInteraction = async () => {
    if (!contact?.id) return
    setSavingInt(true)
    try {
      await api.post('/api/interactions-save', {
        contactId: contact.id,
        date: new Date(intDate).toISOString(),
        type: intType,
        note: intNote.trim(),
      })
      const res = await api.get<InteractionsListResponse>(`/api/interactions-list?contactId=${contact.id}`)
      setInteractions(res.interactions)
      setShowAddInteraction(false)
      setIntNote('')
    } finally {
      setSavingInt(false)
    }
  }

  return (
    <div className="task-panel-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-panel">
        <div className="task-panel-header">
          <span className="task-panel-label">{contact ? 'Editar Contato' : 'Novo Contato'}</span>
          <button className="task-panel-close" onClick={onClose}>×</button>
        </div>

        <div className="task-panel-body" style={{ overflowY: 'auto' }}>
          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
            <div>
              <label className="task-panel-notes-label" style={{ marginTop: 0 }}>Primeiro nome *</label>
              <input
                className="input" style={{ marginTop: '6px' }}
                value={firstName} onChange={e => setFirstName(e.target.value)}
                placeholder="Jorge"
              />
            </div>
            <div>
              <label className="task-panel-notes-label" style={{ marginTop: 0 }}>Sobrenome</label>
              <input
                className="input" style={{ marginTop: '6px' }}
                value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="Paniza"
              />
            </div>
          </div>

          {/* Company / Role */}
          <div className="task-field">
            <span className="task-field-label">Empresa</span>
            <input className="task-field-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="STATE Innovation" />
          </div>
          <div className="task-field">
            <span className="task-field-label">Cargo</span>
            <input className="task-field-input" value={role} onChange={e => setRole(e.target.value)} placeholder="Founder" />
          </div>

          {/* Contact info */}
          <div className="task-field">
            <span className="task-field-label">Email</span>
            <input className="task-field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jorge@state.is" />
          </div>
          <div className="task-field">
            <span className="task-field-label">Telefone</span>
            <input className="task-field-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+55 11 99999-9999" />
          </div>
          <div className="task-field">
            <span className="task-field-label">Aniversário</span>
            <input className="task-field-input" value={birthday} onChange={e => setBirthday(e.target.value)} placeholder="DD/MM" maxLength={5} />
          </div>

          {/* CRM */}
          <div className="task-field">
            <span className="task-field-label">Fase</span>
            <select className="task-field-select" value={phase} onChange={e => setPhase(e.target.value)}>
              <option value="">—</option>
              {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="task-field">
            <span className="task-field-label">Próx. contato</span>
            <input className="task-field-input" type="date" value={nextContact} onChange={e => setNextContact(e.target.value)} />
          </div>

          {/* Notes */}
          <label className="task-panel-notes-label">Notas</label>
          <textarea className="task-panel-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas sobre o contato…" />

          {/* Interactions */}
          {contact?.id && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="task-panel-notes-label" style={{ display: 'inline', marginTop: 0 }}>Interações</span>
                <button className="btn btn-ghost" style={{ fontSize: '9px', padding: '4px 10px' }} onClick={() => setShowAddInteraction(v => !v)}>
                  + Adicionar
                </button>
              </div>

              {showAddInteraction && (
                <div style={{ border: '1px solid var(--border)', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                    <select className="task-field-select input" value={intType} onChange={e => setIntType(e.target.value as typeof intType)}>
                      {INTERACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input className="input" type="date" value={intDate} onChange={e => setIntDate(e.target.value)} />
                  </div>
                  <input className="input" value={intNote} onChange={e => setIntNote(e.target.value)} placeholder="Nota sobre a interação…" style={{ marginBottom: '8px' }} />
                  <button className="btn btn-accent" style={{ width: '100%', justifyContent: 'center', fontSize: '10px' }} onClick={() => { void handleAddInteraction() }} disabled={savingInt}>
                    {savingInt ? 'Salvando…' : 'Salvar interação'}
                  </button>
                </div>
              )}

              <div>
                {interactions.length === 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--fg-dim)', fontFamily: 'Space Mono, monospace', letterSpacing: '1px' }}>
                    Nenhuma interação registrada
                  </div>
                )}
                {interactions.map(int => (
                  <div key={int.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '70px 80px 1fr', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      {TYPE_LABEL[int.type] ?? int.type}
                    </span>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '9px', color: 'var(--fg-dim)', letterSpacing: '1px' }}>
                      {format(parseISO(int.date), 'd MMM yy', { locale: ptBR })}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>{int.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="task-panel-actions">
          {contact?.id && (
            <button className="btn btn-ghost" style={{ borderColor: 'var(--border)' }} onClick={() => { void onArchive(contact.id).then(onClose) }}>
              Arquivar
            </button>
          )}
          <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { void handleSave() }} disabled={saving || !firstName.trim()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
