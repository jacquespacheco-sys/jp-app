import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { PrincipleOfMonth } from '../types/domain.ts'
import type {
  PrincipleOfMonthListResponse,
  PrincipleOfMonthSaveResponse,
  PrincipleOfMonthCurrentResponse,
} from '../types/api.ts'
import type { PrincipleOfMonthSaveInput } from '../../api/_schemas/principle-of-month.ts'

export function usePrincipleOfMonth() {
  const [principles, setPrinciples] = useState<PrincipleOfMonth[]>([])
  const [current, setCurrent] = useState<PrincipleOfMonth | null>(null)
  const [appliedCount, setAppliedCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const [list, cur] = await Promise.all([
        api.get<PrincipleOfMonthListResponse>('/api/principle-of-month-list'),
        api.get<PrincipleOfMonthCurrentResponse & { appliedCount?: number }>('/api/principle-of-month-current'),
      ])
      setPrinciples(list.principles)
      setCurrent(cur.principle)
      setAppliedCount(cur.appliedCount ?? 0)
    } catch {
      setPrinciples([])
      setCurrent(null)
      setAppliedCount(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: PrincipleOfMonthSaveInput): Promise<PrincipleOfMonth> => {
    const res = await api.post<PrincipleOfMonthSaveResponse>('/api/principle-of-month-save', input)
    setPrinciples(prev => {
      const idx = prev.findIndex(p => p.month === res.principle.month)
      if (idx >= 0) return prev.map(p => p.month === res.principle.month ? res.principle : p)
      return [res.principle, ...prev].sort((a, b) => b.month.localeCompare(a.month))
    })
    setCurrent(prev => prev?.month === res.principle.month ? res.principle : prev)
    return res.principle
  }, [])

  return { principles, current, appliedCount, loading, save, refetch: fetch }
}
