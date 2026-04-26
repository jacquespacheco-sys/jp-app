import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Calendar } from '../types/domain.ts'

interface CalendarsState {
  calendars: Calendar[]
  googleConnected: boolean
  loading: boolean
}

interface CalendarsListResponse {
  calendars: Calendar[]
  googleConnected: boolean
}

export function useCalendars() {
  const [state, setState] = useState<CalendarsState>({ calendars: [], googleConnected: false, loading: true })

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<CalendarsListResponse>('/api/calendars-list')
      setState({ calendars: res.calendars, googleConnected: res.googleConnected, loading: false })
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const sync = useCallback(async () => {
    await api.post('/api/calendars-sync')
    await fetch()
  }, [fetch])

  return { ...state, sync, refetch: fetch }
}
