import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ReviewSaveSchema } from './_schemas/hill.js'
import { mapReview } from './_hill.js'
import type { Database } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type ReviewUpdate = Database['public']['Tables']['hill_quarterly_reviews']['Update']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ReviewSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const patch: ReviewUpdate = {
    ...(d.aimDecision !== undefined ? { aim_decision: d.aimDecision } : {}),
    ...(d.affirmationDecisions !== undefined ? { affirmation_decisions: d.affirmationDecisions as never } : {}),
    ...(d.complete ? { completed_at: now } : {}),
  }

  const { data, error } = await supabase
    .from('hill_quarterly_reviews')
    .update(patch)
    .eq('id', d.id)
    .eq('user_id', user.id)
    .is('completed_at', null)
    .select()
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(409).json({ error: 'revisão não encontrada ou já concluída' })

  // Ao concluir: empurra o next_review do Chief Aim para a data calculada no início
  if (d.complete) {
    await supabase.from('hill_chief_aims')
      .update({ next_review: data.next_review_date, updated_at: now })
      .eq('id', data.chief_aim_id).eq('user_id', user.id)
      .then(null, () => {})
  }

  return res.status(200).json({ review: mapReview(data) })
}
