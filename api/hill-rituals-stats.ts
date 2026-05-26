import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { HillRitualType } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const DAY_MS = 86_400_000

function dayStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

// Streak = dias consecutivos com ritual completo, contando de hoje (ou ontem,
// se hoje ainda não foi feito) para trás.
function computeStreak(days: Set<string>, tz: string): number {
  let cursor = new Date()
  if (!days.has(dayStr(cursor, tz))) {
    cursor = new Date(cursor.getTime() - DAY_MS)
    if (!days.has(dayStr(cursor, tz))) return 0
  }
  let streak = 0
  while (days.has(dayStr(cursor, tz))) {
    streak++
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return streak
}

function asNumber(v: unknown): number | undefined {
  const s = Array.isArray(v) ? v[0] : v
  const n = typeof s === 'string' ? Number(s) : typeof s === 'number' ? s : NaN
  return Number.isFinite(n) ? n : undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const days = Math.min(365, Math.max(1, Math.round(asNumber(req.query['days']) ?? 30)))
  const since = new Date(Date.now() - days * DAY_MS).toISOString()
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('hill_ritual_logs')
    .select('type, completed_at')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .gte('completed_at', since)
  if (error) return res.status(500).json({ error: error.message })

  const tz = user.timezone
  const byType: Record<HillRitualType, Set<string>> = { morning: new Set(), night: new Set() }
  for (const row of data ?? []) {
    if (!row.completed_at) continue
    byType[row.type].add(dayStr(new Date(row.completed_at), tz))
  }

  const build = (type: HillRitualType) => {
    const set = byType[type]
    return {
      completed: set.size,
      adherencePct: Math.round((set.size / days) * 100),
      streak: computeStreak(set, tz),
    }
  }

  return res.status(200).json({
    stats: { days, morning: build('morning'), night: build('night') },
  })
}
