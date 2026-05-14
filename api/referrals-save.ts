import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ReferralSaveSchema } from './_schemas/referral.js'
import { mapReferral } from './referrals-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ReferralSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  const ids = [d.fromContactId, ...(d.toContactId ? [d.toContactId] : [])]
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id')
    .in('id', ids)
    .eq('user_id', user.id)
  if (!contacts || contacts.length !== ids.length) {
    return res.status(404).json({ error: 'contato(s) não encontrado(s)' })
  }

  const payload = {
    user_id: user.id,
    from_contact_id: d.fromContactId,
    to_contact_id: d.toContactId ?? null,
    context: d.context,
    outcome_note: d.outcomeNote ?? null,
    feedback_given: d.feedbackGiven,
    feedback_given_at: d.feedbackGivenAt ?? null,
    status: d.status,
  }

  let row: Record<string, unknown>
  if (d.id) {
    const { data, error } = await supabase
      .from('referrals')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  } else {
    const { data, error } = await supabase
      .from('referrals')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  }

  return res.status(d.id ? 200 : 201).json({ referral: mapReferral(row) })
}
