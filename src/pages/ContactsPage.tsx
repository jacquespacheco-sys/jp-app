import { useState } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'

const TABS = ['Lista', 'Pipeline', 'Follow-ups', 'Relações'] as const
type Tab = typeof TABS[number]

export function ContactsPage() {
  const [tab, setTab] = useState<Tab>('Lista')

  return (
    <div>
      <Topbar title="Contatos" actions={<ThemeToggle />} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />
      <div className="content">
        <div className="empty-state">Contatos — {tab}</div>
      </div>
    </div>
  )
}
