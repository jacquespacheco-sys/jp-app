import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ComplimentReciprocateSchema } from './_schemas/compliment.js'
import { mapCompliment } from './compliments-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ComplimentReciprocateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('compliments_received')
    .update({
      reciprocated: true,
      reciprocated_at: now,
      reciprocation_note: d.reciprocationNote ?? null,
    })
    .eq('id', d.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'elogio não encontrado' })

  return res.status(200).json({ compliment: mapCompliment(data as Record<string, unknown>) })
}
