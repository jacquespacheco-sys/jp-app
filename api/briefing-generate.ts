import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { generateBriefing } from './_briefing.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 120

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const today = new Date().toISOString().slice(0, 10)

  const force = req.query['force'] === 'true'

  const { data: existing } = await supabase
    .from('briefings')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  if (existing) {
    if (!force) return res.status(409).json({ error: 'Briefing de hoje já gerado' })
    await supabase.from('briefings').delete().eq('id', existing.id)
  }

  try {
    const briefing = await generateBriefing(user.id, user.email, today)
    return res.status(201).json({ briefing })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao gerar briefing' })
  }
}
