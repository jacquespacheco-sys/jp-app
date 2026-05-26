import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const DAY = 86_400_000

// Reads/skips por afirmação ativa no trimestre — insumo da revisão trimestral.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const since = new Date(Date.now() - 90 * DAY).toISOString()

  const [affRes, logsRes] = await Promise.all([
    supabase.from('hill_affirmations').select('id,dimension,text,belief_score').eq('user_id', user.id).eq('status', 'active').order('dimension'),
    supabase.from('hill_ritual_logs').select('affirmations_read,affirmations_skipped').eq('user_id', user.id).gte('started_at', since),
  ])
  if (affRes.error) return res.status(500).json({ error: affRes.error.message })

  const logs = logsRes.data ?? []
  const stats = (affRes.data ?? []).map(a => {
    const reads = logs.filter(l => (l.affirmations_read ?? []).includes(a.id)).length
    const skips = logs.filter(l => (l.affirmations_skipped ?? []).includes(a.id)).length
    const total = reads + skips
    return {
      id: a.id,
      dimension: a.dimension,
      text: a.text,
      beliefScore: a.belief_score,
      reads,
      skips,
      skipRate: total > 0 ? Math.round((skips / total) * 100) : 0,
    }
  })

  return res.status(200).json({ stats, windowDays: 90 })
}
