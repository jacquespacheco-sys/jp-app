import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { NudgeFeedbackSchema } from './_schemas/hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = NudgeFeedbackSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const { coachMessageId, rating } = parsed.data
  const supabase = getSupabase()

  // Grava o rating no próprio nudge (garante posse via user_id + mode)
  const { data: row, error } = await supabase.from('hill_coach_messages')
    .update({ user_feedback: rating })
    .eq('id', coachMessageId)
    .eq('user_id', user.id)
    .eq('mode', 'daily_nudge')
    .select('id')
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!row) return res.status(404).json({ error: 'nudge não encontrado' })

  // Loga o evento (alimenta a auto-pausa de categoria)
  await supabase.from('hill_nudge_feedback').insert({
    coach_message_id: coachMessageId,
    user_id: user.id,
    rating,
    ...(parsed.data.reason != null ? { reason: parsed.data.reason } : {}),
  }).then(null, () => {})

  return res.status(200).json({ ok: true })
}
