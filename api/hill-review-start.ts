import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { mapReview } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const DAY = 86_400_000

function dayStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
function streakFrom(days: Set<string>, tz: string): number {
  let cursor = new Date()
  if (!days.has(dayStr(cursor, tz))) {
    cursor = new Date(cursor.getTime() - DAY)
    if (!days.has(dayStr(cursor, tz))) return 0
  }
  let n = 0
  while (days.has(dayStr(cursor, tz))) { n++; cursor = new Date(cursor.getTime() - DAY) }
  return n
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: aim, error: aimErr } = await supabase
    .from('hill_chief_aims').select('id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (aimErr) return res.status(500).json({ error: aimErr.message })
  if (!aim) return res.status(400).json({ error: 'sem Chief Aim ativo' })

  // Idempotente: já existe revisão em aberto?
  const { data: open } = await supabase
    .from('hill_quarterly_reviews').select('*')
    .eq('user_id', user.id).is('completed_at', null).maybeSingle()
  if (open) return res.status(200).json({ review: mapReview(open), resumed: true })

  // Snapshot de stats (90 dias)
  const since = new Date(Date.now() - 90 * DAY).toISOString()
  const { data: logs } = await supabase.from('hill_ritual_logs')
    .select('type,completed_at').eq('user_id', user.id).not('completed_at', 'is', null).gte('completed_at', since)
  const tz = user.timezone
  const morning = new Set<string>(), night = new Set<string>()
  for (const l of logs ?? []) {
    if (!l.completed_at) continue
    ;(l.type === 'night' ? night : morning).add(dayStr(new Date(l.completed_at), tz))
  }
  const ritualStats = {
    days: 90,
    morning: { completed: morning.size, adherencePct: Math.round((morning.size / 90) * 100), streak: streakFrom(morning, tz) },
    night: { completed: night.size, adherencePct: Math.round((night.size / 90) * 100), streak: streakFrom(night, tz) },
  }

  const nextReviewDate = new Date(Date.now() + 90 * DAY).toISOString().slice(0, 10)
  const { data, error } = await supabase.from('hill_quarterly_reviews').insert({
    user_id: user.id,
    chief_aim_id: aim.id,
    ritual_stats: ritualStats as never,
    next_review_date: nextReviewDate,
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({ review: mapReview(data), resumed: false })
}
