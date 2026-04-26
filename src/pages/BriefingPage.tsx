import { useState } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'

const TABS = ['Dashboard', 'Email'] as const
type Tab = typeof TABS[number]

export function BriefingPage() {
  const [tab, setTab] = useState<Tab>('Dashboard')

  return (
    <div>
      <Topbar title="Briefing" actions={<ThemeToggle />} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />
      <div className="content">
        <div className="empty-state">
          {tab === 'Dashboard' ? 'Briefing de hoje aparece aqui' : 'Preview do email'}
        </div>
      </div>
    </div>
  )
}
