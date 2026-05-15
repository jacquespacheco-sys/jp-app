import { useState, useMemo, useEffect } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { ContactsList } from '../components/contacts/ContactsList.tsx'
import { PipelineView } from '../components/contacts/PipelineView.tsx'
import { FollowupsView } from '../components/contacts/FollowupsView.tsx'
import { PulseView } from '../components/contacts/PulseView.tsx'
import { RitualsView } from '../components/contacts/RitualsView.tsx'
import { ContactPanel } from '../components/contacts/ContactPanel.tsx'
import { FilterBar, persistedFilter } from '../components/shared/FilterBar.tsx'
import { useContacts } from '../hooks/useContacts.ts'
import { useCategories } from '../hooks/useCategories.ts'
import { applyContactFilter } from '../lib/contactFilter.ts'
import type { Contact, ContactFilter } from '../types/domain.ts'

const TABS = ['Pulso', 'Lista', 'Pipeline', 'Follow-ups', 'Rituais'] as const
type Tab = typeof TABS[number]

const TABS_WITHOUT_SEARCH: readonly Tab[] = ['Pulso', 'Rituais']
const TABS_WITH_FILTER: readonly Tab[] = ['Pulso', 'Lista', 'Pipeline']
const FILTER_KEY = 'contacts:filter'

export function ContactsPage() {
  const [tab, setTab] = useState<Tab>('Pulso')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ContactFilter>(() => persistedFilter(FILTER_KEY))
  const [selected, setSelected] = useState<Contact | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const { contacts, googleConnected, loading, sync } = useContacts()
  const { categories, loading: catsLoading } = useCategories()

  const catDimMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.dimensionId)
    return m
  }, [categories])

  useEffect(() => {
    if (catsLoading) return
    if (!filter.categoryIds?.length) return
    const activeIds = new Set(categories.filter(c => !c.archived).map(c => c.id))
    const cleaned = filter.categoryIds.filter(id => activeIds.has(id))
    if (cleaned.length !== filter.categoryIds.length) {
      setFilter(prev => ({
        ...prev,
        ...(cleaned.length > 0 ? { categoryIds: cleaned } : { categoryIds: undefined as never }),
      } as ContactFilter))
    }
  }, [categories, catsLoading, filter.categoryIds])

  const filtered = useMemo(() => {
    let list = applyContactFilter(contacts, filter, catDimMap)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.firstName.toLowerCase().includes(q) ||
        (c.lastName ?? '').toLowerCase().includes(q) ||
        (c.company ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [contacts, filter, catDimMap, search])

  useEffect(() => {
    setSelected(prev => prev ? contacts.find(c => c.id === prev.id) ?? prev : prev)
  }, [contacts])

  const handleSync = async () => {
    setSyncing(true)
    try { await sync() } finally { setSyncing(false) }
  }

  const openContact = (c: Contact) => { setSelected(c); setPanelOpen(true) }

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {googleConnected && (
        <button className="sync-status" onClick={() => { void handleSync() }} disabled={syncing}>
          {syncing ? 'Sync…' : 'Sync'}
        </button>
      )}
      <button className="icon-btn" onClick={() => { setSelected(null); setPanelOpen(true) }} title="Novo contato">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
      <ThemeToggle />
    </div>
  )

  const showSearch = !TABS_WITHOUT_SEARCH.includes(tab)
  const showFilterBar = TABS_WITH_FILTER.includes(tab)

  return (
    <div>
      <Topbar title="Contatos" actions={actions} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {showSearch && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <input
            className="quick-add-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contatos…"
            style={{ fontSize: '13px' }}
          />
        </div>
      )}

      {showFilterBar && (
        <FilterBar
          storageKey={FILTER_KEY}
          value={filter}
          onChange={setFilter}
          showTier={tab !== 'Pipeline'}
          showPhase={tab === 'Lista'}
          showCategories
        />
      )}

      {loading && <div className="empty-state">Carregando…</div>}

      {!loading && tab === 'Pulso' && <PulseView onOpenContact={openContact} filter={filter} />}
      {!loading && tab === 'Lista' && (
        <>
          {(filter.tier?.length || filter.phase?.length || filter.categoryIds?.length || search.trim()) && (
            <div style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1px' }}>
              Mostrando {filtered.length} de {contacts.length}
            </div>
          )}
          <ContactsList
            contacts={filtered}
            onOpen={openContact}
            onNew={() => { setSelected(null); setPanelOpen(true) }}
          />
        </>
      )}
      {!loading && tab === 'Pipeline' && (
        <PipelineView contacts={filtered} onOpen={openContact} />
      )}
      {!loading && tab === 'Follow-ups' && (
        <FollowupsView contacts={filtered} onOpen={openContact} />
      )}
      {!loading && tab === 'Rituais' && <RitualsView onOpenContact={openContact} />}

      {panelOpen && (
        <ContactPanel
          contact={selected}
          onClose={() => { setPanelOpen(false); setSelected(null) }}
        />
      )}
    </div>
  )
}
