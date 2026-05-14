import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { mapCoachMemoryRow, type CoachMemoryRow } from './_coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('coach_memory')
    .select('*')
    .eq('user_id', user.id)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .order('relevance', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  const memories = (data ?? []).map(r => mapCoachMemoryRow(r as unknown as CoachMemoryRow))
  return res.status(200).json({ memories })
}
