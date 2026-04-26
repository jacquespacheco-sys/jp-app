import { useState, useEffect, useRef } from 'react'
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Topbar } from '../components/layout/Topbar.tsx'
import { Subtabs } from '../components/layout/Subtabs.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { AgendaView } from '../components/calendar/AgendaView.tsx'
import { WeekView } from '../components/calendar/WeekView.tsx'
import { MonthView } from '../components/calendar/MonthView.tsx'
import { EventPanel } from '../components/calendar/EventPanel.tsx'
import { CalendarPicker } from '../components/calendar/CalendarPicker.tsx'
import { useCalendars } from '../hooks/useCalendars.ts'
import { useEvents } from '../hooks/useEvents.ts'
import type { CalendarEvent } from '../types/domain.ts'
import type { EventSaveInput } from '../../api/_schemas/event.ts'
import { api } from '../api.ts'
import type { EventSaveResponse } from '../types/api.ts'

const TABS = ['Semana', 'Mês', 'Agenda', 'Dia'] as const
type Tab = typeof TABS[number]

function rangeForTab(tab: Tab, date: Date): { start: string; end: string } {
  const fmt = (d: Date) => d.toISOString()
  if (tab === 'Semana') return { start: fmt(subDays(date, 3)), end: fmt(addDays(date, 10)) }
  if (tab === 'Mês') return { start: fmt(startOfMonth(date)), end: fmt(endOfMonth(date)) }
  if (tab === 'Dia') return { start: fmt(date), end: fmt(addDays(date, 1)) }
  return { start: fmt(subDays(date, 7)), end: fmt(addDays(date, 30)) }
}

function navTitle(tab: Tab, date: Date): string {
  if (tab === 'Semana') return format(date, "'Semana de' d MMM yyyy", { locale: ptBR })
  if (tab === 'Mês') return format(date, 'MMMM yyyy', { locale: ptBR })
  if (tab === 'Dia') return format(date, "EEEE, d 'de' MMM", { locale: ptBR })
  return format(date, 'MMM yyyy', { locale: ptBR })
}

function goNext(tab: Tab, date: Date): Date {
  if (tab === 'Semana') return addWeeks(date, 1)
  if (tab === 'Mês') return addMonths(date, 1)
  if (tab === 'Dia') return addDays(date, 1)
  return addDays(date, 14)
}

function goPrev(tab: Tab, date: Date): Date {
  if (tab === 'Semana') return subWeeks(date, 1)
  if (tab === 'Mês') return subMonths(date, 1)
  if (tab === 'Dia') return subDays(date, 1)
  return subDays(date, 14)
}

export function CalendarPage() {
  const [tab, setTab] = useState<Tab>('Semana')
  const [date, setDate] = useState(new Date())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const autoSyncDone = useRef(false)

  const { calendars, googleConnected, sync: syncCalendars, refetch: refetchCalendars } = useCalendars()
  const { events, loading, fetchRange, sync: syncEvents, range } = useEvents()

  useEffect(() => {
    const { start, end } = rangeForTab(tab, date)
    void fetchRange(start, end)
  }, [tab, date, fetchRange])

  const handleSync = async () => {
    setSyncing(true)
    try {
      if (calendars.length === 0) await syncCalendars()
      await syncEvents()
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync once on first load if Google is connected but no events found
  useEffect(() => {
    if (googleConnected && range !== null && !loading && events.length === 0 && !autoSyncDone.current) {
      autoSyncDone.current = true
      void handleSync()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleConnected, range, loading, events.length])

  const handleSave = async (input: EventSaveInput) => {
    await api.post<EventSaveResponse>('/api/events-save', input)
    const { start, end } = rangeForTab(tab, date)
    await fetchRange(start, end)
  }

  const handleDelete = async (id: string) => {
    await api.post('/api/events-delete', { id })
    const { start, end } = rangeForTab(tab, date)
    await fetchRange(start, end)
  }

  const handleCalendarToggle = (id: string, visible: boolean) => {
    // Optimistic update via refetch after a tick
    void refetchCalendars()
    // Also refresh events since visible calendars changed
    const { start, end } = rangeForTab(tab, date)
    void fetchRange(start, end)
    void id; void visible
  }

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {googleConnected && (
        <button className="sync-status" onClick={() => { void handleSync() }} disabled={syncing}>
          {syncing ? 'Sync…' : 'Sync'}
        </button>
      )}
      <button className="icon-btn" onClick={() => { setSelected(null); setPanelOpen(true) }} title="Novo evento">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
      <ThemeToggle />
    </div>
  )

  return (
    <div>
      <Topbar title="Calendar" actions={actions} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {calendars.length > 0 && (
        <CalendarPicker calendars={calendars} onToggle={handleCalendarToggle} />
      )}

      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => setDate(d => goPrev(tab, d))}>‹</button>
        <span className="cal-nav-title">{navTitle(tab, date)}</span>
        <button className="cal-nav-btn" onClick={() => setDate(d => goNext(tab, d))}>›</button>
      </div>

      {!googleConnected && calendars.length === 0 && (
        <div className="content">
          <div className="empty-state">
            Google não conectado — vá em Config para sincronizar
          </div>
        </div>
      )}

      {loading && <div className="empty-state">Carregando…</div>}

      {!loading && tab === 'Agenda' && (
        <AgendaView events={events} calendars={calendars} onOpen={ev => { setSelected(ev); setPanelOpen(true) }} />
      )}

      {!loading && tab === 'Semana' && (
        <WeekView date={date} events={events} calendars={calendars} onOpen={ev => { setSelected(ev); setPanelOpen(true) }} />
      )}

      {!loading && tab === 'Mês' && (
        <MonthView date={date} events={events} calendars={calendars} onOpen={ev => { setSelected(ev); setPanelOpen(true) }} />
      )}

      {!loading && tab === 'Dia' && (
        <AgendaView
          events={events.filter(e => e.startAt.slice(0, 10) === format(date, 'yyyy-MM-dd'))}
          calendars={calendars}
          onOpen={ev => { setSelected(ev); setPanelOpen(true) }}
        />
      )}

      {panelOpen && (
        <EventPanel
          event={selected}
          calendars={calendars}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setPanelOpen(false); setSelected(null) }}
        />
      )}
    </div>
  )
}
