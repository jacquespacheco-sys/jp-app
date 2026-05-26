import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { AffirmationRetireSchema } from './_schemas/hill.js'
import { mapAffirmation } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = AffirmationRetireSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('hill_affirmations')
    .update({ status: 'retired', active_until: today, ...(d.retiredReason != null ? { retired_reason: d.retiredReason } : {}) })
    .eq('id', d.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .select()
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(409).json({ error: 'afirmação não está ativa' })

  return res.status(200).json({ affirmation: mapAffirmation(data) })
}
