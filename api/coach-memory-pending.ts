import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type CandidateRow = {
  id: string
  kind: 'fact' | 'pattern' | 'promise' | 'concern' | 'preference'
  content: string
  relevance: number
  expires_at: string | null
  source_log_id: string | null
  created_at: string
}

function mapCandidate(c: CandidateRow) {
  return {
    id: c.id,
    kind: c.kind,
    content: c.content,
    relevance: c.relevance,
    createdAt: c.created_at,
    ...(c.expires_at != null ? { expiresAt: c.expires_at } : {}),
    ...(c.source_log_id != null ? { sourceLogId: c.source_log_id } : {}),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('coach_memory_candidate')
    .select('id,kind,content,relevance,expires_at,source_log_id,created_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    candidates: ((data ?? []) as unknown as CandidateRow[]).map(mapCandidate),
  })
}
