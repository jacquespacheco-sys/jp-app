import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { Database } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type Row = Database['public']['Tables']['hill_coach_messages']['Row']

function mapNudge(r: Row) {
  return {
    id: r.id,
    content: r.content,
    category: r.nudge_category ?? undefined,
    trigger: r.nudge_trigger ?? undefined,
    actionPayload: r.action_payload ?? undefined,
    feedback: r.user_feedback ?? undefined,
    dismissed: r.user_dismissed,
    createdAt: r.created_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data, error } = await supabase.from('hill_coach_messages')
    .select('*')
    .eq('user_id', user.id)
    .eq('mode', 'daily_nudge')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ nudges: (data ?? []).map(mapNudge) })
}
