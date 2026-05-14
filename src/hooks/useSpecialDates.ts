import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { SpecialDate } from '../types/domain.ts'
import type { SpecialDatesListResponse, SpecialDateSaveResponse } from '../types/api.ts'
import type { SpecialDateSaveInput } from '../../api/_schemas/special-date.ts'

export function useSpecialDates(contactId?: string) {
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const qs = contactId ? `?contactId=${contactId}` : ''
      const res = await api.get<SpecialDatesListResponse>(`/api/special-dates-list${qs}`)
      setSpecialDates(res.specialDates)
    } catch {
      setSpecialDates([])
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: SpecialDateSaveInput): Promise<SpecialDate> => {
    const res = await api.post<SpecialDateSaveResponse>('/api/special-dates-save', input)
    setSpecialDates(prev => input.id
      ? prev.map(s => s.id === res.specialDate.id ? res.specialDate : s)
      : [res.specialDate, ...prev]
    )
    return res.specialDate
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.post('/api/special-dates-delete', { id })
    setSpecialDates(prev => prev.filter(s => s.id !== id))
  }, [])

  return { specialDates, loading, save, remove, refetch: fetch }
}
