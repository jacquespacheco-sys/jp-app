import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ReferralStatusUpdateSchema } from './_schemas/referral.js'
import { mapReferral } from './referrals-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ReferralStatusUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload = {
    ...(d.status != null ? { status: d.status } : {}),
    ...(d.feedbackGiven != null ? {
      feedback_given: d.feedbackGiven,
      feedback_given_at: d.feedbackGiven ? now : null,
    } : {}),
    ...(d.outcomeNote != null ? { outcome_note: d.outcomeNote } : {}),
  }

  const { data, error } = await supabase
    .from('referrals')
    .update(payload)
    .eq('id', d.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'referral não encontrado' })

  return res.status(200).json({ referral: mapReferral(data as Record<string, unknown>) })
}
