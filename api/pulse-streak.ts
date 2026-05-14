import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { formatInTimeZone } from 'date-fns-tz'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const DAY_MS = 86400000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: u } = await supabase.from('users').select('timezone').eq('id', user.id).single()
  const tz = (u?.timezone as string | undefined) ?? 'America/Sao_Paulo'

  const sinceIso = new Date(Date.now() - 365 * DAY_MS).toISOString()
  const { data, error } = await supabase
    .from('tasks')
    .select('completed_at')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', sinceIso)

  if (error) return res.status(500).json({ error: error.message })

  const days = new Set<string>()
  for (const row of (data ?? []) as { completed_at: string }[]) {
    days.add(formatInTimeZone(new Date(row.completed_at), tz, 'yyyy-MM-dd'))
  }

  const today = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
  const yesterday = formatInTimeZone(new Date(Date.now() - DAY_MS), tz, 'yyyy-MM-dd')
  const todayHasCompletion = days.has(today)

  let current = 0
  const cursor = new Date()
  if (!todayHasCompletion) {
    if (!days.has(yesterday)) {
      return res.status(200).json({ current: 0, longest: longestStreak(days), todayDone: false })
    }
    cursor.setTime(cursor.getTime() - DAY_MS)
  }
  while (true) {
    const dayStr = formatInTimeZone(cursor, tz, 'yyyy-MM-dd')
    if (!days.has(dayStr)) break
    current += 1
    cursor.setTime(cursor.getTime() - DAY_MS)
  }

  return res.status(200).json({
    current,
    longest: longestStreak(days),
    todayDone: todayHasCompletion,
  })
}

function longestStreak(days: Set<string>): number {
  if (days.size === 0) return 0
  const sorted = [...days].sort()
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`)
    const curr = new Date(`${sorted[i]}T00:00:00Z`)
    if (curr.getTime() - prev.getTime() === DAY_MS) {
      run += 1
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }
  return longest
}
