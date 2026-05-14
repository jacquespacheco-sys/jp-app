import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { GratitudeEntry } from '../types/domain.ts'
import type { GratitudeEntriesListResponse, GratitudeEntrySaveResponse } from '../types/api.ts'
import type { GratitudeEntrySaveInput } from '../../api/_schemas/gratitude-entry.ts'

interface UseGratitudeOpts {
  contactId?: string
  year?: number
  limit?: number
}

export function useGratitudeEntries(opts: UseGratitudeOpts = {}) {
  const [entries, setEntries] = useState<GratitudeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { contactId, year, limit } = opts

  const fetch = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (contactId) params.set('contactId', contactId)
      if (year != null) params.set('year', String(year))
      if (limit != null) params.set('limit', String(limit))
      const qs = params.toString() ? `?${params}` : ''
      const res = await api.get<GratitudeEntriesListResponse>(`/api/gratitude-entries-list${qs}`)
      setEntries(res.entries)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [contactId, year, limit])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: GratitudeEntrySaveInput): Promise<GratitudeEntry> => {
    const res = await api.post<GratitudeEntrySaveResponse>('/api/gratitude-entries-save', input)
    setEntries(prev => [res.entry, ...prev])
    return res.entry
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.post('/api/gratitude-entries-delete', { id })
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  return { entries, loading, save, remove, refetch: fetch }
}
