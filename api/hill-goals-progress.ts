import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { GoalProgressSchema } from './_schemas/hill.js'
import { mapGoal } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = GoalProgressSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('hill_goals')
    .update({ progress_pct: d.progressPct, updated_at: new Date().toISOString() })
    .eq('id', d.id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ goal: mapGoal(data) })
}
