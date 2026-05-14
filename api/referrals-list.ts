import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import { REFERRAL_STATUSES } from './_schemas/referral.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ReferralRow {
  id: string
  user_id: string
  from_contact_id: string
  to_contact_id: string | null
  context: string
  outcome_note: string | null
  feedback_given: boolean
  feedback_given_at: string | null
  status: string
  created_at: string
  updated_at: string
}

export function mapReferral(raw: Record<string, unknown>) {
  const r = raw as Partial<ReferralRow>
  return {
    id: r.id as string,
    userId: r.user_id as string,
    fromContactId: r.from_contact_id as string,
    context: r.context as string,
    feedbackGiven: !!r.feedback_given,
    status: (r.status ?? 'open') as 'open' | 'closed' | 'dropped',
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    ...(r.to_contact_id != null ? { toContactId: r.to_contact_id } : {}),
    ...(r.outcome_note != null ? { outcomeNote: r.outcome_note } : {}),
    ...(r.feedback_given_at != null ? { feedbackGivenAt: r.feedback_given_at } : {}),
  }
}

const Schema = z.object({
  status: z.enum(REFERRAL_STATUSES).optional(),
  pendingFeedback: z.enum(['true', 'false']).optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse({
    status: req.query['status'],
    pendingFeedback: req.query['pendingFeedback'],
  })
  if (!parsed.success) return res.status(400).json({ error: 'query inválida' })

  const supabase = getSupabase()
  let q = supabase.from('referrals').select('*').eq('user_id', user.id)
  if (parsed.data.status) q = q.eq('status', parsed.data.status)
  if (parsed.data.pendingFeedback === 'true') q = q.eq('feedback_given', false).eq('status', 'open')

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    referrals: (data ?? []).map(r => mapReferral(r as Record<string, unknown>)),
  })
}
