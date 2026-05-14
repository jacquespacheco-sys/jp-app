import { useState, useEffect, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { api } from '../../api.ts'
import { useContacts } from '../../hooks/useContacts.ts'
import { ContactPanelDatesTab } from './ContactPanelDatesTab.tsx'
import { ContactPanelComplimentsTab } from './ContactPanelComplimentsTab.tsx'
import { ContactPanelCategoriesTab } from './ContactPanelCategoriesTab.tsx'
import type { Contact, ContactTier, ContactChannel, Interaction } from '../../types/domain.ts'
import type { ContactSaveInput } from '../../../api/_schemas/contact.ts'
import type { InteractionsListResponse } from '../../types/api.ts'

interface Props {
  contact: Contact | null
  onClose: () => void
}

type Tab = 'geral' | 'carnegie' | 'categorias' | 'datas' | 'elogios'

const PHASES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'first', label: '1º Contato' },
  { value: 'talking', label: 'Conversando' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'active', label: 'Ativo' },
  { value: 'dormant', label: 'Adormecido' },
]

const TIERS: { value: ContactTier; label: string; cadence: string }[] = [
  { value: 'inner', label: 'Inner', cadence: '14d' },
  { value: 'strong', label: 'Strong', cadence: '30d' },
  { value: 'network', label: 'Network', cadence: '90d' },
  { value: 'weak', label: 'Weak', cadence: '180d' },
  { value: 'dormant', label: 'Dormant', cadence: '365d' },
]

const CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'sms', label: 'SMS' },
  { value: 'phone', label: 'Telefone' },
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

const splitCsv = (s: string): string[] => s.split(',').map(x => x.trim()).filter(Boolean)
const joinCsv = (xs?: string[]): string => (xs ?? []).join(', ')

export function ContactPanel({ contact, onClose }: Props) {
  const { contacts, save, archive } = useContacts()
  const [tab, setTab] = useState<Tab>('geral')

  // Geral
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

  // Tier (header)
  const [tier, setTier] = useState<ContactTier | ''>(contact?.tier ?? '')
  const [cadenceDays, setCadenceDays] = useState<string>(contact?.cadenceDays != null ? String(contact.cadenceDays) : '')

  // Carnegie
  const [preferredName, setPreferredName] = useState(contact?.preferredName ?? '')
  const [pronunciation, setPronunciation] = useState(contact?.pronunciation ?? '')
  const [interestsStr, setInterestsStr] = useState(joinCsv(contact?.interests))
  const [hooksStr, setHooksStr] = useState(joinCsv(contact?.conversationHooks))
  const [whatTheyValue, setWhatTheyValue] = useState(contact?.whatTheyValue ?? '')
  const [theirGoals, setTheirGoals] = useState(contact?.theirGoals ?? '')
  const [spouse, setSpouse] = useState(contact?.family?.spouse ?? '')
  const [childrenStr, setChildrenStr] = useState(joinCsv(contact?.family?.children))
  const [petsStr, setPetsStr] = useState(joinCsv(contact?.family?.pets))
  const [firstMetAt, setFirstMetAt] = useState(contact?.firstMetAt ? contact.firstMetAt.slice(0, 10) : '')
  const [companyStartDate, setCompanyStartDate] = useState(contact?.companyStartDate ?? '')
  const [preferredChannel, setPreferredChannel] = useState<ContactChannel | ''>(contact?.preferredChannel ?? '')
  const [linkedinUrl, setLinkedinUrl] = useState(contact?.linkedinUrl ?? '')
  const [twitterHandle, setTwitterHandle] = useState(contact?.twitterHandle ?? '')
  const [instagramHandle, setInstagramHandle] = useState(contact?.instagramHandle ?? '')
  const [sourceContactId, setSourceContactId] = useState(contact?.sourceContactId ?? '')
  const [sourceContext, setSourceContext] = useState(contact?.sourceContext ?? '')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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

  const otherContacts = useMemo(
    () => contacts.filter(c => c.id !== contact?.id),
    [contacts, contact?.id]
  )

  const buildInput = (): ContactSaveInput => {
    const interests = splitCsv(interestsStr)
    const hooks = splitCsv(hooksStr)
    const children = splitCsv(childrenStr)
    const pets = splitCsv(petsStr)

    const family = (spouse.trim() || children.length || pets.length)
      ? {
          ...(spouse.trim() ? { spouse: spouse.trim() } : {}),
          ...(children.length ? { children } : {}),
          ...(pets.length ? { pets } : {}),
        }
      : undefined

    return {
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
      tags: contact?.tags ?? [],

      ...(tier ? { tier } : {}),
      ...(cadenceDays.trim() && !isNaN(parseInt(cadenceDays, 10)) ? { cadenceDays: parseInt(cadenceDays, 10) } : {}),
      ...(preferredName.trim() ? { preferredName: preferredName.trim() } : {}),
      ...(pronunciation.trim() ? { pronunciation: pronunciation.trim() } : {}),
      ...(interests.length ? { interests } : {}),
      ...(hooks.length ? { conversationHooks: hooks } : {}),
      ...(whatTheyValue.trim() ? { whatTheyValue: whatTheyValue.trim() } : {}),
      ...(theirGoals.trim() ? { theirGoals: theirGoals.trim() } : {}),
      ...(family ? { family } : {}),
      ...(firstMetAt ? { firstMetAt: new Date(`${firstMetAt}T00:00:00Z`).toISOString() } : {}),
      ...(companyStartDate ? { companyStartDate } : {}),
      ...(preferredChannel ? { preferredChannel } : {}),
      ...(linkedinUrl.trim() ? { linkedinUrl: linkedinUrl.trim() } : {}),
      ...(twitterHandle.trim() ? { twitterHandle: twitterHandle.trim() } : {}),
      ...(instagramHandle.trim() ? { instagramHandle: instagramHandle.trim() } : {}),
      ...(sourceContactId ? { sourceContactId } : {}),
      ...(sourceContext.trim() ? { sourceContext: sourceContext.trim() } : {}),
    }
  }

  const handleSave = async () => {
    if (!firstName.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      await save(buildInput())
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!contact?.id) return
    await archive(contact.id, true)
    onClose()
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

  const tabs: { key: Tab; label: string; available: boolean }[] = [
    { key: 'geral', label: 'Geral', available: true },
    { key: 'carnegie', label: 'Carnegie', available: true },
    { key: 'categorias', label: 'Categorias', available: !!contact?.id },
    { key: 'datas', label: 'Datas', available: !!contact?.id },
    { key: 'elogios', label: 'Elogios', available: !!contact?.id },
  ]

  return (
    <div className="task-panel-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-panel">
        <div className="task-panel-header">
          <span className="task-panel-label">{contact ? 'Editar Contato' : 'Novo Contato'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              className="task-field-select"
              value={tier}
              onChange={e => setTier(e.target.value as ContactTier | '')}
              style={{ fontSize: '10px', padding: '4px 6px', fontFamily: 'Space Mono, monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
              title="Tier (cadência relacional)"
            >
              <option value="">— tier —</option>
              {TIERS.map(t => (
                <option key={t.value} value={t.value}>{t.label} · {t.cadence}</option>
              ))}
            </select>
            <button className="task-panel-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
          {tabs.filter(t => t.available).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t.key ? 'var(--fg)' : 'var(--fg-muted)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '10px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="task-panel-body" style={{ overflowY: 'auto' }}>
          {tab === 'geral' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
                <div>
                  <label className="task-panel-notes-label" style={{ marginTop: 0 }}>Primeiro nome *</label>
                  <input className="input" style={{ marginTop: '6px' }} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jorge" />
                </div>
                <div>
                  <label className="task-panel-notes-label" style={{ marginTop: 0 }}>Sobrenome</label>
                  <input className="input" style={{ marginTop: '6px' }} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Paniza" />
                </div>
              </div>

              <div className="task-field">
                <span className="task-field-label">Empresa</span>
                <input className="task-field-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="STATE Innovation" />
              </div>
              <div className="task-field">
                <span className="task-field-label">Cargo</span>
                <input className="task-field-input" value={role} onChange={e => setRole(e.target.value)} placeholder="Founder" />
              </div>

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

              <label className="task-panel-notes-label">Notas</label>
              <textarea className="task-panel-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas sobre o contato…" />

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
            </>
          )}

          {tab === 'carnegie' && (
            <>
              <div className="task-field">
                <span className="task-field-label">Como prefere</span>
                <input className="task-field-input" value={preferredName} onChange={e => setPreferredName(e.target.value)} placeholder="apelido / como gostam de ser chamados" />
              </div>
              <div className="task-field">
                <span className="task-field-label">Pronúncia</span>
                <input className="task-field-input" value={pronunciation} onChange={e => setPronunciation(e.target.value)} placeholder="ex: JOR-ji (caso o nome seja difícil)" />
              </div>
              <div className="task-field">
                <span className="task-field-label">Canal pref.</span>
                <select className="task-field-select" value={preferredChannel} onChange={e => setPreferredChannel(e.target.value as ContactChannel | '')}>
                  <option value="">—</option>
                  {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="task-field">
                <span className="task-field-label">Cadência</span>
                <input className="task-field-input" type="number" min="1" value={cadenceDays} onChange={e => setCadenceDays(e.target.value)} placeholder={tier ? `default do tier` : 'dias entre contatos'} />
              </div>

              <label className="task-panel-notes-label">O que valorizam (P9)</label>
              <textarea className="task-panel-notes" value={whatTheyValue} onChange={e => setWhatTheyValue(e.target.value)} placeholder="Como essa pessoa se sente importante…" style={{ minHeight: '60px' }} />

              <label className="task-panel-notes-label">O que querem (P3)</label>
              <textarea className="task-panel-notes" value={theirGoals} onChange={e => setTheirGoals(e.target.value)} placeholder="Eager want — o que estão buscando…" style={{ minHeight: '60px' }} />

              <label className="task-panel-notes-label">Interesses</label>
              <input className="input" value={interestsStr} onChange={e => setInterestsStr(e.target.value)} placeholder="separe por vírgula: vinho, surf, jazz…" />

              <label className="task-panel-notes-label">Hooks de conversa (P8)</label>
              <input className="input" value={hooksStr} onChange={e => setHooksStr(e.target.value)} placeholder="tópicos que destravam: filhos, escalada…" />

              <label className="task-panel-notes-label" style={{ marginTop: '18px' }}>Família</label>
              <div className="task-field">
                <span className="task-field-label">Cônjuge</span>
                <input className="task-field-input" value={spouse} onChange={e => setSpouse(e.target.value)} placeholder="nome" />
              </div>
              <div className="task-field">
                <span className="task-field-label">Filhos</span>
                <input className="task-field-input" value={childrenStr} onChange={e => setChildrenStr(e.target.value)} placeholder="separe por vírgula" />
              </div>
              <div className="task-field">
                <span className="task-field-label">Pets</span>
                <input className="task-field-input" value={petsStr} onChange={e => setPetsStr(e.target.value)} placeholder="separe por vírgula" />
              </div>

              <label className="task-panel-notes-label" style={{ marginTop: '18px' }}>Conhecemos desde</label>
              <div className="task-field">
                <span className="task-field-label">1º contato</span>
                <input className="task-field-input" type="date" value={firstMetAt} onChange={e => setFirstMetAt(e.target.value)} />
              </div>
              <div className="task-field">
                <span className="task-field-label">Na empresa</span>
                <input className="task-field-input" type="date" value={companyStartDate} onChange={e => setCompanyStartDate(e.target.value)} />
              </div>

              <label className="task-panel-notes-label" style={{ marginTop: '18px' }}>Presença digital</label>
              <div className="task-field">
                <span className="task-field-label">LinkedIn</span>
                <input className="task-field-input" type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
              </div>
              <div className="task-field">
                <span className="task-field-label">Twitter</span>
                <input className="task-field-input" value={twitterHandle} onChange={e => setTwitterHandle(e.target.value)} placeholder="@handle" />
              </div>
              <div className="task-field">
                <span className="task-field-label">Instagram</span>
                <input className="task-field-input" value={instagramHandle} onChange={e => setInstagramHandle(e.target.value)} placeholder="@handle" />
              </div>

              <label className="task-panel-notes-label" style={{ marginTop: '18px' }}>Origem</label>
              <div className="task-field">
                <span className="task-field-label">Indicação</span>
                <select className="task-field-select" value={sourceContactId} onChange={e => setSourceContactId(e.target.value)}>
                  <option value="">— quem indicou —</option>
                  {otherContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName}{c.lastName ? ` ${c.lastName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="task-field">
                <span className="task-field-label">Contexto</span>
                <input className="task-field-input" value={sourceContext} onChange={e => setSourceContext(e.target.value)} placeholder='ex: "evento Bimbo", "indicação Marina"' />
              </div>
            </>
          )}

          {tab === 'categorias' && contact?.id && (
            <ContactPanelCategoriesTab
              contactId={contact.id}
              initialCategoryIds={(contact.categories ?? []).map(c => c.id)}
            />
          )}
          {tab === 'datas' && contact?.id && <ContactPanelDatesTab contactId={contact.id} />}
          {tab === 'elogios' && contact?.id && <ContactPanelComplimentsTab contactId={contact.id} />}
        </div>

        <div className="task-panel-actions" style={{ flexDirection: 'column', gap: '8px' }}>
          {saveError && (
            <div style={{ fontSize: '11px', fontFamily: 'Space Mono, monospace', color: 'var(--danger)', letterSpacing: '0.5px', padding: '8px 10px', border: '1px solid var(--danger)', width: '100%' }}>
              {saveError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            {contact?.id && (
              <button className="btn btn-ghost" style={{ borderColor: 'var(--border)' }} onClick={() => { void handleArchive() }}>
                Arquivar
              </button>
            )}
            <button className="btn btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { void handleSave() }} disabled={saving || !firstName.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
