import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface CadenceDaily { type: 'daily' }
interface CadenceWeekdays { type: 'weekdays' }
interface CadenceWeekly { type: 'weekly'; days: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[] }
interface CadenceEveryN { type: 'every_n_days'; n: number }
interface CadenceMonthly { type: 'monthly'; dayOfMonth: number }
type Cadence = CadenceDaily | CadenceWeekdays | CadenceWeekly | CadenceEveryN | CadenceMonthly

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

function shouldDoOn(cadence: Cadence, date: Date): boolean {
  const dow = date.getUTCDay()
  switch (cadence.type) {
    case 'daily': return true
    case 'weekdays': return dow >= 1 && dow <= 5
    case 'weekly': return cadence.days.includes(DAY_CODES[dow])
    case 'every_n_days': return true // simplification — proper impl would need anchor date
    case 'monthly': return date.getUTCDate() === cadence.dayOfMonth
  }
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

interface StreakInfo {
  habitId: string
  currentStreak: number       // dias consecutivos completados (full ou min) até hoje
  longestStreak: number       // maior sequência nos últimos 90 dias
  doneToday: 'full' | 'min' | 'skip' | null
  rateLast30: number          // % de dias devidos completados (full ou min) últimos 30 dias
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [habitsRes, logsRes] = await Promise.all([
    supabase.from('habits').select('id, cadence, active').eq('user_id', user.id).is('archived_at', null).eq('active', true),
    supabase.from('habit_logs')
      .select('habit_id, done_on, dose')
      .eq('user_id', user.id)
      .gte('done_on', isoDate(ninetyDaysAgo))
      .order('done_on', { ascending: false }),
  ])

  if (habitsRes.error) return res.status(500).json({ error: habitsRes.error.message })
  if (logsRes.error) return res.status(500).json({ error: logsRes.error.message })

  const habits = habitsRes.data ?? []
  const logs = logsRes.data ?? []

  // Agrupa logs por habit_id
  const logsByHabit = new Map<string, { doneOn: string; dose: 'full' | 'min' | 'skip' }[]>()
  for (const l of logs) {
    const arr = logsByHabit.get(l.habit_id) ?? []
    arr.push({ doneOn: l.done_on, dose: l.dose as 'full' | 'min' | 'skip' })
    logsByHabit.set(l.habit_id, arr)
  }

  const todayStr = isoDate(today)

  const streaks: StreakInfo[] = habits.map(h => {
    const cadence = h.cadence as unknown as Cadence
    const habitLogs = logsByHabit.get(h.id) ?? []
    const logByDate = new Map(habitLogs.map(l => [l.doneOn, l.dose]))

    // Today's status
    const doneToday = logByDate.get(todayStr) ?? null

    // Walk back day-by-day computing streak
    let currentStreak = 0
    {
      const cursor = new Date(today)
      while (true) {
        const ds = isoDate(cursor)
        const expected = shouldDoOn(cadence, cursor)
        const log = logByDate.get(ds)
        if (!expected) {
          // dia não devido — não quebra streak, só não conta
          cursor.setUTCDate(cursor.getUTCDate() - 1)
          if (cursor < ninetyDaysAgo) break
          continue
        }
        if (log === 'full' || log === 'min') {
          currentStreak += 1
          cursor.setUTCDate(cursor.getUTCDate() - 1)
        } else {
          // dia devido sem log positivo — quebra (tolera se for hoje sem log ainda)
          if (ds === todayStr && !log) {
            cursor.setUTCDate(cursor.getUTCDate() - 1)
            continue
          }
          break
        }
        if (cursor < ninetyDaysAgo) break
      }
    }

    // Longest streak nos últimos 90 dias
    let longestStreak = 0
    {
      let run = 0
      const cursor = new Date(ninetyDaysAgo)
      while (cursor <= today) {
        const ds = isoDate(cursor)
        const expected = shouldDoOn(cadence, cursor)
        if (!expected) {
          cursor.setUTCDate(cursor.getUTCDate() + 1)
          continue
        }
        const log = logByDate.get(ds)
        if (log === 'full' || log === 'min') {
          run += 1
          longestStreak = Math.max(longestStreak, run)
        } else {
          run = 0
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }

    // Taxa últimos 30 dias
    let dueCount = 0
    let doneCount = 0
    {
      const cursor = new Date(thirtyDaysAgo)
      while (cursor <= today) {
        const ds = isoDate(cursor)
        if (shouldDoOn(cadence, cursor)) {
          dueCount += 1
          const log = logByDate.get(ds)
          if (log === 'full' || log === 'min') doneCount += 1
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }
    const rateLast30 = dueCount > 0 ? Math.round((doneCount / dueCount) * 100) : 0

    return {
      habitId: h.id,
      currentStreak,
      longestStreak,
      doneToday,
      rateLast30,
    }
  })

  return res.status(200).json({ streaks })
}
