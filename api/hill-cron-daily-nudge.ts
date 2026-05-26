import { requireCron } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { processUserNudge } from './_hill-nudges.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 300

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireCron(req, res)) return

  const supabase = getSupabase()
  const { data: aims, error } = await supabase.from('hill_chief_aims')
    .select('user_id, created_at').eq('is_active', true)
  if (error) return res.status(500).json({ error: error.message })
  if (!aims || aims.length === 0) return res.status(200).json({ processed: 0, sent: 0 })

  const userIds = [...new Set(aims.map(a => a.user_id))]
  const { data: users } = await supabase.from('users').select('id, timezone').in('id', userIds)
  const tzMap = new Map((users ?? []).map(u => [u.id, u.timezone]))

  let sent = 0
  for (const aim of aims) {
    try {
      const tz = tzMap.get(aim.user_id) ?? 'America/Sao_Paulo'
      const cat = await processUserNudge(aim.user_id, tz, aim.created_at)
      if (cat) sent++
    } catch (e) {
      console.error('[hill-daily-nudge]', aim.user_id, e instanceof Error ? e.message : e)
    }
  }
  return res.status(200).json({ processed: aims.length, sent })
}
