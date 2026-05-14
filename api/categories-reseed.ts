import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { error } = await supabase.rpc('seed_carnegie_categories', { p_user_id: user.id })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ reseeded: true })
}
