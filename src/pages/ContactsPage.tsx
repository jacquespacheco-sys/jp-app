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
import type { Contact, ContactFilter, ContactTier } from '../types/domain.ts'

const TABS = ['Pulso', 'Lista', 'Pipeline', 'Follow-ups', 'Rituais'] as const
type Tab = typeof TABS[number]

const TABS_WITHOUT_SEARCH: readonly Tab[] = ['Pulso', 'Rituais']
const FILTER_KEY = 'contacts:filter'

function applyContactFilter(
  contacts: Contact[],
  filter: ContactFilter,
  catDimMap: Map<string, string>,
): Contact[] {
  if (!filter.tier?.length && !filter.phase?.length && !filter.categoryIds?.length) {
    return contacts
  }

  const tierSet = filter.tier ? new Set<ContactTier>(filter.tier) : null
  const phaseSet = filter.phase ? new Set(filter.phase) : null

  let dimGroups: Set<string>[] | null = null
  if (filter.categoryIds && filter.categoryIds.length > 0) {
    const groups = new Map<string, Set<string>>()
    for (const cid of filter.categoryIds) {
      const dimId = catDimMap.get(cid) ?? '_unknown'
      const set = groups.get(dimId) ?? new Set<string>()
      set.add(cid)
      groups.set(dimId, set)
    }
    dimGroups = [...groups.values()]
  }

  return contacts.filter(c => {
    if (tierSet && (!c.tier || !tierSet.has(c.tier))) return false
    if (phaseSet && (!c.phase || !phaseSet.has(c.phase))) return false
    if (dimGroups) {
      const ids = new Set((c.categories ?? []).map(cc => cc.id))
      if (!dimGroups.every(group => [...group].some(id => ids.has(id)))) return false
    }
    return true
  })
}

export function ContactsPage() {
  const [tab, setTab] = useState<Tab>('Pulso')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ContactFilter>(() => persistedFilter(FILTER_KEY))
  const [selected, setSelected] = useState<Contact | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const { contacts, googleConnected, loading, sync } = useContacts()
  const { categories } = useCategories()

  const catDimMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories) m.set(c.id, c.dimensionId)
    return m
  }, [categories])

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
  const showFilterBar = tab === 'Lista'

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
          showTier
          showPhase
          showCategories
        />
      )}

      {loading && <div className="empty-state">Carregando…</div>}

      {!loading && tab === 'Pulso' && <PulseView onOpenContact={openContact} />}
      {!loading && tab === 'Lista' && (
        <>
          {(filter.tier?.length || filter.phase?.length || filter.categoryIds?.length || search.trim()) && (
            <div style={{ padding: '10px 16px', fontFamily: 'Space Mono, monospace', fontSize: '10px', color: 'var(--fg-muted)', letterSpacing: '1px' }}>
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
