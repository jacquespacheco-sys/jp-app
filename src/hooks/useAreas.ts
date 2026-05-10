import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Area } from '../types/domain.ts'
import type { AreasListResponse, AreaSaveResponse } from '../types/api.ts'
import type { AreaSaveInput } from '../../api/_schemas/area.ts'

export function useAreas() {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<AreasListResponse>('/api/areas-list')
      setAreas(res.areas)
    } catch {
      setAreas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: AreaSaveInput): Promise<Area> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<AreaSaveResponse>('/api/areas-save', input)
    setAreas(prev =>
      input.id
        ? prev.map(a => (a.id === res.area.id ? res.area : a))
        : [...prev, res.area]
    )
    return res.area
  }, [])

  const archive = useCallback(async (id: string) => {
    await api.patch('/api/areas-archive', { id, archive: true })
    setAreas(prev => prev.filter(a => a.id !== id))
  }, [])

  return { areas, loading, save, archive, refetch: fetch }
}
