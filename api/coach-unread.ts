import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: userRow } = await supabase
    .from('users').select('coach_last_read_at').eq('id', user.id).maybeSingle()

  const lastReadAt = (userRow as { coach_last_read_at: string | null } | null)?.coach_last_read_at ?? '1970-01-01T00:00:00Z'

  const { count, error } = await supabase.from('coach_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('direction', 'coach_to_user')
    .in('kind', ['chat', 'check_in', 'callout', 'celebration'])
    .gt('created_at', lastReadAt)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ unread: count ?? 0 })
}
