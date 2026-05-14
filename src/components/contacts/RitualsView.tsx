import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { api } from '../../api.ts'
import { useContacts } from '../../hooks/useContacts.ts'
import { usePrincipleOfMonth } from '../../hooks/usePrincipleOfMonth.ts'
import { useWeeklyReflections } from '../../hooks/useWeeklyReflections.ts'
import { useGratitudeEntries } from '../../hooks/useGratitudeEntries.ts'
import { GRATITUDE_CHANNELS } from '../../../api/_schemas/gratitude-entry.ts'
import { SuggestMessageModal } from './SuggestMessageModal.tsx'
import type { Contact, ContactChannel } from '../../types/domain.ts'

interface Props {
  onOpenContact: (c: Contact) => void
}

interface TopContact {
  contactId: string
  firstName: string
  lastName: string | null
  tier: string | null
  lastInteractionAt: string | null
  mentions: number
}

const PRINCIPLE_OPTIONS = Array.from({ length: 30 }, (_, i) => `P${i + 1}`)

const CHANNEL_LABEL: Record<ContactChannel, string> = {
  whatsapp: 'WhatsApp', email: 'Email', linkedin: 'LinkedIn', sms: 'SMS', phone: 'Telefone',
}

const currentMonth = () => format(new Date(), 'yyyy-MM')
const currentWeek = () => format(new Date(), "RRRR-'W'II")

export function RitualsView({ onOpenContact }: Props) {
  const [openModal, setOpenModal] = useState<'principle' | 'reflection' | 'gratitude' | null>(null)
  const [suggestFor, setSuggestFor] = useState<Contact | null>(null)

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '14px' }}>
      <PrincipleCard onOpen={() => setOpenModal('principle')} />
      <WeeklyReflectionCard onOpen={() => setOpenModal('reflection')} />
      <GratitudeCard onOpen={() => setOpenModal('gratitude')} />
      <ThankYouTourCard
        onSuggestMessage={setSuggestFor}
        onOpenContact={onOpenContact}
      />

      {openModal === 'principle' && <PrincipleModal onClose={() => setOpenModal(null)} />}
      {openModal === 'reflection' && <ReflectionModal onClose={() => setOpenModal(null)} />}
      {openModal === 'gratitude' && <GratitudeModal onClose={() => setOpenModal(null)} />}
      {suggestFor && <SuggestMessageModal contact={suggestFor} onClose={() => setSuggestFor(null)} />}
    </div>
  )
}

// ============================================================
// Cards
// ============================================================

function PrincipleCard({ onOpen }: { onOpen: () => void }) {
  const { current } = usePrincipleOfMonth()
  return (
    <Card title="Princípio do mês" subtitle={current?.month ?? currentMonth()}>
      {current ? (
        <>
          <CardValue>{current.principle}</CardValue>
          <CardSubvalue>Meta: {current.targetApplications} aplicações</CardSubvalue>
          {current.reflection && (
            <div style={{ fontSize: '12px', color: 'var(--fg)', fontStyle: 'italic', marginTop: '8px' }}>
              {current.reflection}
            </div>
          )}
        </>
      ) : (
        <CardEmpty>Nenhum princípio definido para este mês</CardEmpty>
      )}
      <CardAction onClick={onOpen}>{current ? 'Editar' : 'Definir princípio'}</CardAction>
    </Card>
  )
}

function WeeklyReflectionCard({ onOpen }: { onOpen: () => void }) {
  const { current } = useWeeklyReflections()
  return (
    <Card title="Reflexão semanal" subtitle={current?.week ?? currentWeek()}>
      {current ? (
        <>
          <CardValue>Respondida</CardValue>
          {current.reconnectContactId && !current.reconnectHandled && (
            <CardSubvalue>Reconectar pendente — vai pro Pulso de segunda</CardSubvalue>
          )}
        </>
      ) : (
        <CardEmpty>3 perguntas. Domingo, 19h.</CardEmpty>
      )}
      <CardAction onClick={onOpen}>{current ? 'Editar' : 'Responder'}</CardAction>
    </Card>
  )
}

function GratitudeCard({ onOpen }: { onOpen: () => void }) {
  const { entries } = useGratitudeEntries({ limit: 5 })
  return (
    <Card title="Diário de gratidão" subtitle="Sexta, 18h">
      {entries.length === 0 ? (
        <CardEmpty>Nenhuma entrada ainda</CardEmpty>
      ) : (
        <>
          <CardValue>{entries.length} entrada{entries.length === 1 ? '' : 's'} recente{entries.length === 1 ? '' : 's'}</CardValue>
          <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--fg-muted)', borderLeft: '2px solid var(--accent)', paddingLeft: '10px' }}>
            "{entries[0]?.text}"
          </div>
        </>
      )}
      <CardAction onClick={onOpen}>+ Adicionar</CardAction>
    </Card>
  )
}

function ThankYouTourCard({
  onSuggestMessage, onOpenContact,
}: {
  onSuggestMessage: (c: Contact) => void
  onOpenContact: (c: Contact) => void
}) {
  const { contacts } = useContacts()
  const [top, setTop] = useState<TopContact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void api.get<{ topContacts: TopContact[] }>('/api/gratitude-top-contacts?days=90')
      .then(r => { setTop(r.topContacts); setLoading(false) })
      .catch(() => { setTop([]); setLoading(false) })
  }, [])

  return (
    <Card title="Thank You Tour" subtitle="Últimos 90 dias">
      {loading ? (
        <CardEmpty>Carregando…</CardEmpty>
      ) : top.length === 0 ? (
        <CardEmpty>Sem dados de gratidão ainda</CardEmpty>
      ) : (
        <div style={{ marginTop: '4px' }}>
          {top.slice(0, 5).map(t => {
            const full = contacts.find(c => c.id === t.contactId)
            return (
              <div
                key={t.contactId}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: '10px',
                  alignItems: 'center',
                }}
              >
                <div
                  onClick={() => full && onOpenContact(full)}
                  style={{ fontSize: '13px', color: 'var(--fg)', cursor: full ? 'pointer' : 'default' }}
                >
                  {t.firstName}{t.lastName ? ` ${t.lastName}` : ''}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {t.mentions}× · {t.tier ?? '—'}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '9px', padding: '3px 7px' }}
                  onClick={() => full && onSuggestMessage(full)}
                  disabled={!full}
                  title="Sugerir mensagem"
                >
                  ✨
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ============================================================
// Modals
// ============================================================

function PrincipleModal({ onClose }: { onClose: () => void }) {
  const { current, save } = usePrincipleOfMonth()
  const [principle, setPrinciple] = useState(current?.principle ?? 'P1')
  const [month, setMonth] = useState(current?.month ?? currentMonth())
  const [targetApplications, setTargetApplications] = useState(current?.targetApplications ?? 12)
  const [reflection, setReflection] = useState(current?.reflection ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await save({
        principle, month, targetApplications,
        ...(reflection.trim() ? { reflection: reflection.trim() } : {}),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Princípio do mês" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div>
          <Label>Princípio</Label>
          <select className="input" value={principle} onChange={e => setPrinciple(e.target.value)}>
            {PRINCIPLE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <Label>Mês (YYYY-MM)</Label>
          <input className="input" value={month} onChange={e => setMonth(e.target.value)} placeholder="2026-05" />
        </div>
      </div>
      <Label>Meta de aplicações</Label>
      <input
        className="input" type="number" min="1" max="100"
        value={targetApplications}
        onChange={e => setTargetApplications(parseInt(e.target.value, 10) || 12)}
        style={{ marginBottom: '12px' }}
      />
      <Label>Reflexão</Label>
      <textarea
        className="task-panel-notes"
        value={reflection}
        onChange={e => setReflection(e.target.value)}
        placeholder="Por que esse princípio agora?"
        style={{ minHeight: '80px' }}
      />
      <ModalAction onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar'}
      </ModalAction>
    </Modal>
  )
}

function ReflectionModal({ onClose }: { onClose: () => void }) {
  const { contacts } = useContacts()
  const { current, save } = useWeeklyReflections()
  const [week, setWeek] = useState(current?.week ?? currentWeek())
  const [markedMeContactId, setMarkedMeContactId] = useState(current?.markedMeContactId ?? '')
  const [markedMeWhy, setMarkedMeWhy] = useState(current?.markedMeWhy ?? '')
  const [letDownContactId, setLetDownContactId] = useState(current?.letDownContactId ?? '')
  const [letDownWhy, setLetDownWhy] = useState(current?.letDownWhy ?? '')
  const [reconnectContactId, setReconnectContactId] = useState(current?.reconnectContactId ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await save({
        week,
        ...(markedMeContactId ? { markedMeContactId } : {}),
        ...(markedMeWhy.trim() ? { markedMeWhy: markedMeWhy.trim() } : {}),
        ...(letDownContactId ? { letDownContactId } : {}),
        ...(letDownWhy.trim() ? { letDownWhy: letDownWhy.trim() } : {}),
        ...(reconnectContactId ? { reconnectContactId } : {}),
        reconnectHandled: current?.reconnectHandled ?? false,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Reflexão semanal" onClose={onClose}>
      <Label>Semana (YYYY-Wxx)</Label>
      <input className="input" value={week} onChange={e => setWeek(e.target.value)} placeholder="2026-W19" style={{ marginBottom: '16px' }} />

      <ReflectionQuestion
        label="Quem te marcou esta semana?"
        contactId={markedMeContactId}
        why={markedMeWhy}
        onContactChange={setMarkedMeContactId}
        onWhyChange={setMarkedMeWhy}
        contacts={contacts}
      />
      <ReflectionQuestion
        label="Quem você decepcionou?"
        contactId={letDownContactId}
        why={letDownWhy}
        onContactChange={setLetDownContactId}
        onWhyChange={setLetDownWhy}
        contacts={contacts}
      />

      <Label>Quem você quer reaproximar?</Label>
      <select className="input" value={reconnectContactId} onChange={e => setReconnectContactId(e.target.value)} style={{ marginBottom: '12px' }}>
        <option value="">—</option>
        {contacts.map(c => (
          <option key={c.id} value={c.id}>{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</option>
        ))}
      </select>

      <ModalAction onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando…' : 'Salvar reflexão'}
      </ModalAction>
    </Modal>
  )
}

function ReflectionQuestion({
  label, contactId, why, onContactChange, onWhyChange, contacts,
}: {
  label: string
  contactId: string
  why: string
  onContactChange: (id: string) => void
  onWhyChange: (s: string) => void
  contacts: Contact[]
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <Label>{label}</Label>
      <select className="input" value={contactId} onChange={e => onContactChange(e.target.value)} style={{ marginBottom: '6px' }}>
        <option value="">—</option>
        {contacts.map(c => (
          <option key={c.id} value={c.id}>{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</option>
        ))}
      </select>
      <input
        className="input" placeholder="Por quê?"
        value={why} onChange={e => onWhyChange(e.target.value)}
      />
    </div>
  )
}

function GratitudeModal({ onClose }: { onClose: () => void }) {
  const { contacts } = useContacts()
  const { save } = useGratitudeEntries()
  const [text, setText] = useState('')
  const [contactId, setContactId] = useState('')
  const [shared, setShared] = useState(false)
  const [sharedChannel, setSharedChannel] = useState<ContactChannel | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!text.trim()) { setError('Texto obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      await save({
        text: text.trim(),
        ...(contactId ? { contactId } : {}),
        shared,
        ...(shared && sharedChannel ? { sharedChannel } : {}),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Diário de gratidão" onClose={onClose}>
      <Label>Pelo quê? (máx 280 chars)</Label>
      <textarea
        className="task-panel-notes" maxLength={280}
        value={text} onChange={e => setText(e.target.value)}
        placeholder="Hoje sou grato por…"
        style={{ minHeight: '80px', marginBottom: '4px' }}
      />
      <div style={{ fontSize: '9px', color: 'var(--fg-dim)', textAlign: 'right', fontFamily: 'var(--font-mono)', marginBottom: '12px' }}>
        {text.length}/280
      </div>

      <Label>Pessoa (opcional)</Label>
      <select className="input" value={contactId} onChange={e => setContactId(e.target.value)} style={{ marginBottom: '12px' }}>
        <option value="">—</option>
        {contacts.map(c => (
          <option key={c.id} value={c.id}>{c.firstName}{c.lastName ? ` ${c.lastName}` : ''}</option>
        ))}
      </select>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: shared ? '8px' : '12px', fontSize: '12px', color: 'var(--fg)' }}>
        <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />
        Compartilhar com a pessoa
      </label>
      {shared && (
        <select className="input" value={sharedChannel} onChange={e => setSharedChannel(e.target.value as ContactChannel | '')} style={{ marginBottom: '12px' }}>
          <option value="">— canal —</option>
          {GRATITUDE_CHANNELS.map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
        </select>
      )}

      {error && (
        <div style={{ fontSize: '10px', color: 'var(--danger)', marginBottom: '8px', fontFamily: 'var(--font-mono)', letterSpacing: '0.5px' }}>
          {error}
        </div>
      )}
      <ModalAction onClick={handleSave} disabled={saving || !text.trim()}>
        {saving ? 'Salvando…' : 'Salvar'}
      </ModalAction>
    </Modal>
  )
}

// ============================================================
// Building blocks
// ============================================================

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', padding: '14px', background: 'var(--bg-elevated)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg)', letterSpacing: '2px', textTransform: 'uppercase' }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px' }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function CardValue({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '20px', fontFamily: 'var(--font-display)', letterSpacing: '2px', color: 'var(--fg)' }}>{children}</div>
}

function CardSubvalue({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1px', marginTop: '4px' }}>{children}</div>
}

function CardEmpty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '12px', color: 'var(--fg-dim)' }}>{children}</div>
}

function CardAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button className="btn btn-ghost" style={{ marginTop: '12px', width: '100%', justifyContent: 'center', fontSize: '10px' }} onClick={onClick}>
      {children}
    </button>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="task-panel-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="task-panel">
        <div className="task-panel-header">
          <span className="task-panel-label">{title}</span>
          <button className="task-panel-close" onClick={onClose}>×</button>
        </div>
        <div className="task-panel-body" style={{ overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="task-panel-notes-label" style={{ display: 'block', marginTop: 0 }}>{children}</label>
  )
}

function ModalAction({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="btn btn-accent"
      style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
      onClick={() => { void onClick() }}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

