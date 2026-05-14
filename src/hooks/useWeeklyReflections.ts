import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { WeeklyReflection } from '../types/domain.ts'
import type {
  WeeklyReflectionsListResponse,
  WeeklyReflectionSaveResponse,
  WeeklyReflectionCurrentResponse,
} from '../types/api.ts'
import type { WeeklyReflectionSaveInput } from '../../api/_schemas/weekly-reflection.ts'

export function useWeeklyReflections() {
  const [reflections, setReflections] = useState<WeeklyReflection[]>([])
  const [current, setCurrent] = useState<WeeklyReflection | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const [list, cur] = await Promise.all([
        api.get<WeeklyReflectionsListResponse>('/api/weekly-reflections-list'),
        api.get<WeeklyReflectionCurrentResponse>('/api/weekly-reflections-current'),
      ])
      setReflections(list.reflections)
      setCurrent(cur.reflection)
    } catch {
      setReflections([])
      setCurrent(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: WeeklyReflectionSaveInput): Promise<WeeklyReflection> => {
    const res = await api.post<WeeklyReflectionSaveResponse>('/api/weekly-reflections-save', input)
    setReflections(prev => {
      const idx = prev.findIndex(r => r.week === res.reflection.week)
      if (idx >= 0) return prev.map(r => r.week === res.reflection.week ? res.reflection : r)
      return [res.reflection, ...prev].sort((a, b) => b.week.localeCompare(a.week))
    })
    setCurrent(prev => prev?.week === res.reflection.week ? res.reflection : prev)
    return res.reflection
  }, [])

  return { reflections, current, loading, save, refetch: fetch }
}
