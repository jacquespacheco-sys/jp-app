import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { mapAffirmation } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('hill_affirmations')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('dimension', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ affirmations: (data ?? []).map(mapAffirmation) })
}
