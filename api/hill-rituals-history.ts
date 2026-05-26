import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { mapRitualLog } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function asDate(v: unknown): string | undefined {
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && DATE_RE.test(s) ? s : undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const from = asDate(req.query['from'])
  const to = asDate(req.query['to'])

  let query = supabase
    .from('hill_ritual_logs')
    .select('*')
    .eq('user_id', user.id)
  if (from) query = query.gte('started_at', `${from}T00:00:00.000Z`)
  if (to) query = query.lte('started_at', `${to}T23:59:59.999Z`)

  const { data, error } = await query.order('started_at', { ascending: false }).limit(200)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ rituals: (data ?? []).map(mapRitualLog) })
}
