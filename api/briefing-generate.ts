import './_env.ts'
import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { generateBriefing } from './_briefing.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 120

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const today = new Date().toISOString().slice(0, 10)

  const { data: existing } = await supabase
    .from('briefings')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  if (existing) {
    return res.status(409).json({ error: 'Briefing de hoje já gerado' })
  }

  try {
    const briefing = await generateBriefing(user.id, user.email, today)
    return res.status(201).json({ briefing })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao gerar briefing' })
  }
}
