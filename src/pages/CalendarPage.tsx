import { useState } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'

const TABS = ['Dia', 'Semana', 'Mês', 'Agenda'] as const
type Tab = typeof TABS[number]

export function CalendarPage() {
  const [tab, setTab] = useState<Tab>('Semana')

  return (
    <div>
      <Topbar title="Calendar" actions={<ThemeToggle />} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />
      <div className="content">
        <div className="empty-state">Calendar — {tab}</div>
      </div>
    </div>
  )
}
