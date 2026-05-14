import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Compliment } from '../types/domain.ts'
import type { ComplimentsListResponse, ComplimentSaveResponse } from '../types/api.ts'
import type { ComplimentSaveInput, ComplimentReciprocateInput } from '../../api/_schemas/compliment.ts'

interface UseComplimentsOpts {
  contactId?: string
  pending?: boolean
}

export function useCompliments(opts: UseComplimentsOpts = {}) {
  const [compliments, setCompliments] = useState<Compliment[]>([])
  const [loading, setLoading] = useState(true)
  const { contactId, pending } = opts

  const fetch = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (contactId) params.set('contactId', contactId)
      if (pending) params.set('pending', 'true')
      const qs = params.toString() ? `?${params}` : ''
      const res = await api.get<ComplimentsListResponse>(`/api/compliments-list${qs}`)
      setCompliments(res.compliments)
    } catch {
      setCompliments([])
    } finally {
      setLoading(false)
    }
  }, [contactId, pending])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: ComplimentSaveInput): Promise<Compliment> => {
    const res = await api.post<ComplimentSaveResponse>('/api/compliments-save', input)
    setCompliments(prev => input.id
      ? prev.map(c => c.id === res.compliment.id ? res.compliment : c)
      : [res.compliment, ...prev]
    )
    return res.compliment
  }, [])

  const reciprocate = useCallback(async (input: ComplimentReciprocateInput): Promise<Compliment> => {
    const res = await api.post<ComplimentSaveResponse>('/api/compliments-reciprocate', input)
    setCompliments(prev => prev.map(c => c.id === res.compliment.id ? res.compliment : c))
    return res.compliment
  }, [])

  return { compliments, loading, save, reciprocate, refetch: fetch }
}
