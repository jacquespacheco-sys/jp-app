import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Habit, HabitLog, HabitStreak } from '../types/domain.ts'
import type {
  HabitsListResponse, HabitSaveResponse,
  HabitLogSaveResponse, HabitStreaksResponse,
} from '../types/api.ts'
import type { HabitSaveInput, HabitLogSaveInput } from '../../api/_schemas/habit.ts'

export function useHabits(opts?: { includeInactive?: boolean }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [streaks, setStreaks] = useState<HabitStreak[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const q = opts?.includeInactive ? '?inactive=true' : ''
      const [habitsRes, streaksRes] = await Promise.all([
        api.get<HabitsListResponse>(`/api/habits-list${q}`),
        api.get<HabitStreaksResponse>('/api/habits-streaks'),
      ])
      setHabits(habitsRes.habits)
      setStreaks(streaksRes.streaks)
    } catch {
      setHabits([])
      setStreaks([])
    } finally {
      setLoading(false)
    }
  }, [opts?.includeInactive])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: HabitSaveInput): Promise<Habit> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<HabitSaveResponse>('/api/habits-save', input)
    setHabits(prev =>
      input.id
        ? prev.map(h => (h.id === res.habit.id ? res.habit : h))
        : [...prev, res.habit]
    )
    return res.habit
  }, [])

  const archive = useCallback(async (id: string) => {
    await api.post('/api/habits-archive', { id })
    setHabits(prev => prev.filter(h => h.id !== id))
    setStreaks(prev => prev.filter(s => s.habitId !== id))
  }, [])

  const log = useCallback(async (input: HabitLogSaveInput): Promise<HabitLog> => {
    const res = await api.post<HabitLogSaveResponse>('/api/habit-logs-save', input)
    // Recompute streaks for accurate state
    try {
      const streaksRes = await api.get<HabitStreaksResponse>('/api/habits-streaks')
      setStreaks(streaksRes.streaks)
    } catch { /* noop */ }
    return res.log
  }, [])

  const todayHelper = useCallback((habitId: string, dose: 'full' | 'min' | 'skip', note?: string) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const d = new Date()
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return log({ habitId, doneOn: today, dose, note })
  }, [log])

  return { habits, streaks, loading, save, archive, log, logToday: todayHelper, refetch: fetch }
}
