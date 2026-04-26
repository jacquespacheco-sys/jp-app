import { useState, useMemo } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { ContactsList } from '../components/contacts/ContactsList.tsx'
import { PipelineView } from '../components/contacts/PipelineView.tsx'
import { FollowupsView } from '../components/contacts/FollowupsView.tsx'
import { ContactPanel } from '../components/contacts/ContactPanel.tsx'
import { useContacts } from '../hooks/useContacts.ts'
import type { Contact } from '../types/domain.ts'
import type { ContactSaveInput } from '../../api/_schemas/contact.ts'

const TABS = ['Lista', 'Pipeline', 'Follow-ups'] as const
type Tab = typeof TABS[number]

export function ContactsPage() {
  const [tab, setTab] = useState<Tab>('Lista')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const { contacts, googleConnected, loading, save, archive, sync } = useContacts()

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts
    const q = search.toLowerCase()
    return contacts.filter(c =>
      c.firstName.toLowerCase().includes(q) ||
      (c.lastName ?? '').toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    )
  }, [contacts, search])

  const handleSync = async () => {
    setSyncing(true)
    try { await sync() } finally { setSyncing(false) }
  }

  const handleSave = async (input: ContactSaveInput) => {
    await save(input)
  }

  const handleArchive = async (id: string) => {
    await archive(id, true)
  }

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

  return (
    <div>
      <Topbar title="Contatos" actions={actions} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {/* Search bar */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <input
          className="quick-add-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar contatos…"
          style={{ fontSize: '13px' }}
        />
      </div>

      {loading && <div className="empty-state">Carregando…</div>}

      {!loading && tab === 'Lista' && (
        <ContactsList
          contacts={filtered}
          onOpen={c => { setSelected(c); setPanelOpen(true) }}
          onNew={() => { setSelected(null); setPanelOpen(true) }}
        />
      )}

      {!loading && tab === 'Pipeline' && (
        <PipelineView
          contacts={filtered}
          onOpen={c => { setSelected(c); setPanelOpen(true) }}
        />
      )}

      {!loading && tab === 'Follow-ups' && (
        <FollowupsView
          contacts={filtered}
          onOpen={c => { setSelected(c); setPanelOpen(true) }}
        />
      )}

      {panelOpen && (
        <ContactPanel
          contact={selected}
          onSave={handleSave}
          onArchive={handleArchive}
          onClose={() => { setPanelOpen(false); setSelected(null) }}
        />
      )}
    </div>
  )
}
