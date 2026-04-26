import { useState, useCallback } from 'react'
import { api } from '../api.ts'
import type { CalendarEvent } from '../types/domain.ts'
import type { EventsListResponse } from '../types/api.ts'

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState<{ start: string; end: string } | null>(null)

  const fetchRange = useCallback(async (start: string, end: string) => {
    setLoading(true)
    try {
      const res = await api.get<EventsListResponse>(`/api/events-list?start=${start}&end=${end}`)
      setEvents(res.events as CalendarEvent[])
      setRange({ start, end })
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  const sync = useCallback(async () => {
    await api.post('/api/events-sync')
    if (range) await fetchRange(range.start, range.end)
  }, [range, fetchRange])

  return { events, loading, fetchRange, sync, range }
}
