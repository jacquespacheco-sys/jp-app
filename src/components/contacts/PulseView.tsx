import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { api } from '../../api.ts'
import { useContacts } from '../../hooks/useContacts.ts'
import { usePrincipleOfMonth } from '../../hooks/usePrincipleOfMonth.ts'
import { useReferrals } from '../../hooks/useReferrals.ts'
import { matchesContactFilter } from '../../lib/contactFilter.ts'
import type { Contact, SpecialDate, ContactTier, ContactFilter } from '../../types/domain.ts'

interface Props {
  onOpenContact: (c: Contact) => void
  filter?: ContactFilter
}

type UpcomingDate = SpecialDate & { occurrenceDate: string; daysUntil: number }

const TIER_CADENCE: Record<ContactTier, number> = {
  inner: 14, strong: 30, network: 90, weak: 180, dormant: 365,
}

const TYPE_LABEL: Record<string, string> = {
  celebrate: 'Celebrar', acknowledge: 'Reconhecer', silence: 'Silenciar', check_in: 'Check-in',
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

interface PromiseItem {
  id: string
  title: string
  dueDate: string | null
  contactId: string | null
  contactName: string | null
}

interface StreakInfo {
  current: number
  longest: number
  todayDone: boolean
}

export function PulseView({ onOpenContact, filter }: Props) {
  const navigate = useNavigate()
  const { contacts } = useContacts()
  const { current: currentPrinciple, appliedCount } = usePrincipleOfMonth()
  const { referrals: allLoops } = useReferrals({ pendingFeedback: true })
  const [upcoming, setUpcoming] = useState<UpcomingDate[]>([])
  const [unclassifiedCount, setUnclassifiedCount] = useState<number | null>(null)
  const [promises, setPromises] = useState<PromiseItem[]>([])
  const [streak, setStreak] = useState<StreakInfo | null>(null)

  const catDimMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts) {
      for (const cat of c.categories ?? []) m.set(cat.id, cat.dimensionId)
    }
    return m
  }, [contacts])

  const pendingLoops = useMemo(() => {
    if (!filter?.categoryIds?.length) return allLoops
    return allLoops.filter(r => {
      const from = contacts.find(c => c.id === r.fromContactId)
      return from && matchesContactFilter(from, filter, catDimMap)
    })
  }, [allLoops, filter, contacts, catDimMap])

  useEffect(() => {
    void api.get<{ specialDates: UpcomingDate[] }>('/api/special-dates-upcoming?days=14')
      .then(r => setUpcoming(r.specialDates))
      .catch(() => setUpcoming([]))

    void api.get<{ totalRemaining: number }>('/api/contacts-onboarding-queue?limit=1')
      .then(r => setUnclassifiedCount(r.totalRemaining))
      .catch(() => setUnclassifiedCount(null))

    void api.get<{ promises: PromiseItem[]; count: number }>('/api/tasks-promises')
      .then(r => setPromises(r.promises))
      .catch(() => setPromises([]))

    void api.get<StreakInfo>('/api/pulse-streak')
      .then(r => setStreak(r))
      .catch(() => setStreak(null))
  }, [])

  const innerStrongOverdue = useMemo(() => {
    return contacts
      .filter(c => {
        if (!c.tier || (c.tier !== 'inner' && c.tier !== 'strong')) return false
        if (!matchesContactFilter(c, filter, catDimMap)) return false
        if (!c.lastInteractionAt) return true
        const cadence = c.cadenceDays ?? TIER_CADENCE[c.tier]
        return daysSince(c.lastInteractionAt) > cadence
      })
      .map(c => ({
        contact: c,
        daysSince: c.lastInteractionAt ? daysSince(c.lastInteractionAt) : null,
        cadence: c.cadenceDays ?? TIER_CADENCE[c.tier as ContactTier],
      }))
      .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
  }, [contacts, filter, catDimMap])

  return (
    <div style={{ padding: '16px' }}>
      {unclassifiedCount != null && unclassifiedCount > 0 && (
        <div
          onClick={() => navigate('/onboarding-contatos')}
          style={{
            border: '1px solid var(--accent)',
            background: 'var(--accent-faint)',
            padding: '12px 14px',
            marginBottom: '16px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', color: 'var(--fg)', marginBottom: '2px' }}>
              {unclassifiedCount} contatos sem classificar
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Revisar tier + hooks
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-ink)', letterSpacing: '1.5px' }}>→</span>
        </div>
      )}

      {/* Princípio do Mês */}
      <div style={{
        border: '1px solid var(--accent)',
        background: 'var(--accent-faint)',
        padding: '16px',
        marginBottom: '24px',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
          Princípio do mês {currentPrinciple ? `· ${currentPrinciple.month}` : ''}
        </div>
        {currentPrinciple ? (
          <>
            <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', letterSpacing: '2px', marginBottom: '4px' }}>
              {currentPrinciple.principle}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1px', marginBottom: currentPrinciple.reflection ? '10px' : 0 }}>
              {appliedCount}/{currentPrinciple.targetApplications} aplicações no mês
              {appliedCount >= currentPrinciple.targetApplications && ' ✓'}
            </div>
            {currentPrinciple.reflection && (
              <div style={{ fontSize: '12px', color: 'var(--fg)', fontStyle: 'italic', borderLeft: '2px solid var(--accent)', paddingLeft: '10px' }}>
                {currentPrinciple.reflection}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--fg-dim)' }}>
            Nenhum princípio para o mês. Defina em Rituais.
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '14px' }}>
        <Stat label="Inner/Strong em atraso" value={innerStrongOverdue.length} />
        <Stat label="Loops sem feedback" value={pendingLoops.length} />
        <Stat label="Promessas atrasadas" value={promises.length} />
        <Stat
          label={streak?.todayDone ? `Streak atual · hoje ✓` : 'Streak atual'}
          value={streak?.current ?? 0}
          {...(streak && streak.longest > streak.current ? { subtitle: `recorde ${streak.longest}` } : {})}
        />
      </div>

      {promises.length > 0 && (
        <Section title={`Promessas atrasadas (${promises.length})`}>
          {promises.slice(0, 5).map(p => {
            const c = p.contactId ? contacts.find(x => x.id === p.contactId) : null
            return (
              <Row key={p.id} {...(c ? { onClick: () => onOpenContact(c) } : {})}>
                <RowMain>
                  <RowName>{p.title}</RowName>
                  <RowDetail>
                    {p.contactName ?? '—'}
                    {p.dueDate ? ` · venceu ${p.dueDate}` : ''}
                  </RowDetail>
                </RowMain>
              </Row>
            )
          })}
        </Section>
      )}

      {/* Datas próximas */}
      <Section title={`Datas próximas (${upcoming.length})`}>
        {upcoming.length === 0 ? (
          <EmptyLine>Nada nos próximos 14 dias</EmptyLine>
        ) : (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {upcoming.map(d => (
              <div key={d.id} style={{
                minWidth: '140px',
                border: '1px solid var(--border)',
                padding: '10px',
                background: 'var(--bg-elevated)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {d.daysUntil === 0 ? 'Hoje' : d.daysUntil === 1 ? 'Amanhã' : `Em ${d.daysUntil}d`}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--fg)', marginBottom: '2px' }}>{d.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  {TYPE_LABEL[d.type]}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Loops a fechar */}
      <Section title={`Loops a fechar (${pendingLoops.length})`}>
        {pendingLoops.length === 0 ? (
          <EmptyLine>Nenhuma indicação esperando feedback</EmptyLine>
        ) : (
          pendingLoops.slice(0, 5).map(r => {
            const from = contacts.find(c => c.id === r.fromContactId)
            return (
              <Row key={r.id} {...(from ? { onClick: () => onOpenContact(from) } : {})}>
                <RowMain>
                  <RowName>{from ? `${from.firstName}${from.lastName ? ` ${from.lastName}` : ''}` : '—'}</RowName>
                  <RowDetail>{r.context}</RowDetail>
                </RowMain>
                <RowMeta>{format(parseISO(r.createdAt), 'd MMM', { locale: ptBR })}</RowMeta>
              </Row>
            )
          })
        )}
      </Section>

      {/* Inner/Strong em atraso */}
      <Section title={`Inner/Strong em atraso (${innerStrongOverdue.length})`}>
        {innerStrongOverdue.length === 0 ? (
          <EmptyLine>Em dia com o círculo interno</EmptyLine>
        ) : (
          innerStrongOverdue.slice(0, 10).map(x => (
            <Row key={x.contact.id} onClick={() => onOpenContact(x.contact)}>
              <RowMain>
                <RowName>
                  {x.contact.firstName}{x.contact.lastName ? ` ${x.contact.lastName}` : ''}
                  <span style={{ marginLeft: '8px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {x.contact.tier}
                  </span>
                </RowName>
                <RowDetail>
                  {x.daysSince != null
                    ? `${x.daysSince}d desde o último contato · cadência ${x.cadence}d`
                    : `Sem registro de contato · cadência ${x.cadence}d`}
                </RowDetail>
              </RowMain>
            </Row>
          ))
        )}
      </Section>
    </div>
  )
}

function Stat({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', padding: '12px', background: 'var(--bg-elevated)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontFamily: 'var(--font-display)', letterSpacing: '2px', color: value > 0 ? 'var(--accent)' : 'var(--fg-muted)' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--fg-dim)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '3px' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 0',
        borderBottom: '1px solid var(--border-light)',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '10px',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  )
}

function RowMain({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}

function RowName({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '13px', color: 'var(--fg)', marginBottom: '2px' }}>{children}</div>
}

function RowDetail({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-dim)', letterSpacing: '1px' }}>
      {children}
    </div>
  )
}

function RowMeta({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--fg-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>
      {children}
    </div>
  )
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '12px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', letterSpacing: '1px', padding: '8px 0' }}>
      {children}
    </div>
  )
}
