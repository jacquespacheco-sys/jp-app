import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { mapReview } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const DAY = 86_400_000

function todayStr(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: aim, error } = await supabase
    .from('hill_chief_aims').select('id, next_review')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!aim) return res.status(200).json({ pending: false, nextReview: null, daysUntil: null, activeReview: null })

  const { data: open } = await supabase
    .from('hill_quarterly_reviews').select('*')
    .eq('user_id', user.id).is('completed_at', null)
    .order('triggered_at', { ascending: false }).maybeSingle()

  const today = todayStr(user.timezone)
  const daysUntil = Math.round((new Date(`${aim.next_review}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY)

  return res.status(200).json({
    pending: aim.next_review <= today,
    nextReview: aim.next_review,
    daysUntil,
    activeReview: open ? mapReview(open) : null,
  })
}
