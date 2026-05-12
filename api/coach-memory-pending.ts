import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('coach_memory_candidate')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    candidates: (data ?? []).map(c => ({
      id: c.id, kind: c.kind, content: c.content, relevance: c.relevance,
      expiresAt: c.expires_at, sourceLogId: c.source_log_id, createdAt: c.created_at,
    })),
  })
}
