import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Ritual } from '../types/domain.ts'
import type { RitualsListResponse, RitualSaveResponse } from '../types/api.ts'
import type { RitualSaveInput } from '../../api/_schemas/habit.ts'

export function useRituals() {
  const [rituals, setRituals] = useState<Ritual[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<RitualsListResponse>('/api/rituals-list')
      setRituals(res.rituals)
    } catch {
      setRituals([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: RitualSaveInput): Promise<Ritual> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<RitualSaveResponse>('/api/rituals-save', input)
    setRituals(prev =>
      input.id
        ? prev.map(r => (r.id === res.ritual.id ? res.ritual : r))
        : [...prev, res.ritual]
    )
    return res.ritual
  }, [])

  const archive = useCallback(async (id: string) => {
    await api.post('/api/rituals-archive', { id })
    setRituals(prev => prev.filter(r => r.id !== id))
  }, [])

  return { rituals, loading, save, archive, refetch: fetch }
}
