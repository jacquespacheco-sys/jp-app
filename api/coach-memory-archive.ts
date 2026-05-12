import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachMemoryArchiveSchema } from './_schemas/coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachMemoryArchiveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'id obrigatório' })

  const supabase = getSupabase()
  const { error } = await supabase
    .from('coach_memory')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
