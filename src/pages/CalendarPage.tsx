import { useState, useEffect, useRef, useMemo } from 'react'
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
import { useTasks } from '../hooks/useTasks.ts'
import type { CalendarEvent, Task } from '../types/domain.ts'
import type { EventSaveInput } from '../../api/_schemas/event.ts'
import { api } from '../api.ts'
import type { EventSaveResponse } from '../types/api.ts'

const TABS = ['Dia', 'Agenda', 'Semana', 'Mês'] as const
type Tab = typeof TABS[number]

interface ParsedEvent {
  summary: string
  startAt: string
  endAt: string
  allDay: boolean
  location: string | null
  notes: string | null
}

function taskToEvent(task: Task): CalendarEvent {
  const dayStr = task.dueDate!.slice(0, 10)
  return {
    id: `task-${task.id}`, userId: task.userId, calendarId: '',
    summary: task.title,
    startAt: `${dayStr}T00:00:00.000Z`, endAt: `${dayStr}T23:59:59.000Z`,
    allDay: true, status: 'confirmed', isOrganizer: false,
    source: 'task_block', taskId: task.id, synced: false,
    createdAt: task.createdAt, updatedAt: task.updatedAt,
  }
}

function rangeForTab(tab: Tab, date: Date): { start: string; end: string } {
  const fmt = (d: Date) => d.toISOString()
  if (tab === 'Semana') return { start: fmt(subDays(date, 3)), end: fmt(addDays(date, 10)) }
  if (tab === 'Mês') return { start: fmt(startOfMonth(date)), end: fmt(endOfMonth(date)) }
  if (tab === 'Dia') return { start: fmt(date), end: fmt(addDays(date, 1)) }
  return { start: fmt(date), end: fmt(addDays(date, 6)) }
}

function navTitle(tab: Tab, date: Date): string {
  if (tab === 'Semana') return format(date, "'Semana de' d MMM yyyy", { locale: ptBR })
  if (tab === 'Mês') return format(date, 'MMMM yyyy', { locale: ptBR })
  if (tab === 'Dia') return format(date, "EEEE, d 'de' MMM", { locale: ptBR })
  return `${format(date, 'd MMM', { locale: ptBR })} – ${format(addDays(date, 6), 'd MMM', { locale: ptBR })}`
}

function goNext(tab: Tab, date: Date): Date {
  if (tab === 'Semana') return addWeeks(date, 1)
  if (tab === 'Mês') return addMonths(date, 1)
  if (tab === 'Dia') return addDays(date, 1)
  return addDays(date, 7)
}

function goPrev(tab: Tab, date: Date): Date {
  if (tab === 'Semana') return subWeeks(date, 1)
  if (tab === 'Mês') return subMonths(date, 1)
  if (tab === 'Dia') return subDays(date, 1)
  return subDays(date, 7)
}

export function CalendarPage() {
  const [tab, setTab] = useState<Tab>('Dia')
  const [date, setDate] = useState(new Date())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [prefill, setPrefill] = useState<{ summary?: string; startAt?: string; endAt?: string; allDay?: boolean; location?: string; description?: string } | undefined>()
  const [syncing, setSyncing] = useState(false)
  const [nlpBar, setNlpBar] = useState(false)
  const [nlpText, setNlpText] = useState('')
  const [nlpLoading, setNlpLoading] = useState(false)
  const [nlpError, setNlpError] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const nlpRef = useRef<HTMLInputElement>(null)
  const autoSyncDone = useRef(false)

  const { calendars, googleConnected, sync: syncCalendars, refetch: refetchCalendars } = useCalendars()
  const { events, loading, fetchRange, sync: syncEvents, range } = useEvents()
  const { tasks } = useTasks()

  useEffect(() => {
    setLastSync(localStorage.getItem('jp_cal_last_sync'))
  }, [])

  useEffect(() => {
    const { start, end } = rangeForTab(tab, date)
    void fetchRange(start, end)
  }, [tab, date, fetchRange])

  const taskEvents = useMemo<CalendarEvent[]>(() => {
    if (!range) return []
    const rangeStart = range.start.slice(0, 10)
    const rangeEnd = range.end.slice(0, 10)
    return tasks
      .filter(t => t.dueDate && !t.archived && t.status !== 'done')
      .filter(t => { const day = t.dueDate!.slice(0, 10); return day >= rangeStart && day <= rangeEnd })
      .map(taskToEvent)
  }, [tasks, range])

  const allEvents = useMemo(() => [...events, ...taskEvents], [events, taskEvents])

  const handleSync = async () => {
    setSyncing(true)
    try {
      if (calendars.length === 0) await syncCalendars()
      await syncEvents()
      const ts = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      localStorage.setItem('jp_cal_last_sync', ts)
      setLastSync(ts)
    } finally {
      setSyncing(false)
    }
  }

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
    void refetchCalendars()
    const { start, end } = rangeForTab(tab, date)
    void fetchRange(start, end)
    void id; void visible
  }

  const handleOpen = (ev: CalendarEvent) => {
    if (ev.source === 'task_block') return
    setSelected(ev); setPrefill(undefined); setPanelOpen(true)
  }

  const handleNlpSubmit = async () => {
    const text = nlpText.trim()
    if (!text) return
    setNlpLoading(true); setNlpError('')
    try {
      const result = await api.post<ParsedEvent>('/api/events-parse', { text, lang: 'auto' })
      setSelected(null)
      setPrefill({
        summary: result.summary, startAt: result.startAt, endAt: result.endAt, allDay: result.allDay,
        ...(result.location != null && { location: result.location }),
        ...(result.notes != null && { description: result.notes }),
      })
      setPanelOpen(true); setNlpBar(false); setNlpText('')
    } catch (e) {
      setNlpError(e instanceof Error ? e.message : 'Erro ao interpretar')
    } finally {
      setNlpLoading(false)
    }
  }

  useEffect(() => { if (nlpBar) setTimeout(() => nlpRef.current?.focus(), 50) }, [nlpBar])

  const actions = (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {googleConnected && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
          <button className="sync-status" onClick={() => { void handleSync() }} disabled={syncing}>
            {syncing ? 'Sync…' : 'Sync'}
          </button>
          {lastSync && <span style={{ fontSize: '7px', fontFamily: 'Space Mono, monospace', color: 'var(--fg-dim)', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>{lastSync}</span>}
        </div>
      )}
      <button
        className="icon-btn"
        onClick={() => { setNlpBar(v => !v); setNlpError('') }}
        title="Criar com texto"
        style={nlpBar ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
      >
        <svg viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </button>
      <button className="icon-btn" onClick={() => { setSelected(null); setPrefill(undefined); setPanelOpen(true) }} title="Novo evento">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <ThemeToggle />
    </div>
  )

  return (
    <div>
      <Topbar title="Calendar" actions={actions} />
      <Subtabs tabs={[...TABS]} active={tab} onChange={t => setTab(t as Tab)} />

      {nlpBar && (
        <div className="nlp-bar">
          <input
            ref={nlpRef}
            value={nlpText}
            onChange={e => setNlpText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleNlpSubmit() }}
            placeholder="Ex: Reunião com João amanhã às 15h por 1h no escritório"
            disabled={nlpLoading}
          />
          {nlpError && <span style={{ fontSize: '10px', color: 'var(--danger)', whiteSpace: 'nowrap' }}>{nlpError}</span>}
          <button className="btn btn-accent" style={{ fontSize: '10px', padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={() => void handleNlpSubmit()} disabled={nlpLoading || !nlpText.trim()}>
            {nlpLoading ? '…' : 'Criar'}
          </button>
        </div>
      )}

      {calendars.length > 0 && (
        <CalendarPicker calendars={calendars} onToggle={handleCalendarToggle} />
      )}

      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => setDate(d => goPrev(tab, d))}>‹</button>
        <span className="cal-nav-title">{navTitle(tab, date)}</span>
        <button className="cal-nav-btn" onClick={() => setDate(d => goNext(tab, d))}>›</button>
      </div>

      {!googleConnected && calendars.length === 0 && (
        <div className="content"><div className="empty-state">Google não conectado — vá em Config para sincronizar</div></div>
      )}

      {loading && <div className="empty-state">Carregando…</div>}

      {!loading && tab === 'Dia' && (
        <AgendaView
          events={allEvents.filter(e => e.startAt.slice(0, 10) === format(date, 'yyyy-MM-dd'))}
          calendars={calendars} onOpen={handleOpen}
        />
      )}
      {!loading && tab === 'Agenda' && (
        <AgendaView events={allEvents} calendars={calendars} onOpen={handleOpen} />
      )}
      {!loading && tab === 'Semana' && (
        <WeekView date={date} events={allEvents} calendars={calendars} onOpen={handleOpen} />
      )}
      {!loading && tab === 'Mês' && (
        <MonthView date={date} events={allEvents} calendars={calendars} onOpen={handleOpen} />
      )}

      {panelOpen && (
        <EventPanel
          event={selected}
          {...(prefill !== undefined ? { prefill } : {})}
          calendars={calendars}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setPanelOpen(false); setSelected(null); setPrefill(undefined) }}
        />
      )}
    </div>
  )
}
