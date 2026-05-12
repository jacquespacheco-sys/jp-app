import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachMemoryDismissSchema } from './_schemas/coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachMemoryDismissSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('coach_memory_candidate')
    .update({ status: 'dismissed', decided_at: new Date().toISOString() })
    .eq('id', parsed.data.candidateId)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
