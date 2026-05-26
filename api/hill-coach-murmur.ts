import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachMurmurSchema } from './_schemas/hill.js'
import { generateCoachMessage } from './_hill-coach.js'
import type { HillCoachVoice } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 30

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachMurmurSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const supabase = getSupabase()
  const { data: prefs } = await supabase.from('hill_preferences')
    .select('coach_voice, ritual_murmurs_enabled').eq('user_id', user.id).maybeSingle()

  // Murmurs desligados nas preferências → silêncio (o coach acompanha, não interrompe)
  if (prefs && prefs.ritual_murmurs_enabled === false) {
    return res.status(200).json({ content: null })
  }
  const voice = (prefs?.coach_voice ?? 'mixed') as HillCoachVoice

  try {
    const out = await generateCoachMessage({
      userId: user.id, userTimezone: user.timezone, mode: 'ritual_murmur', voice, murmurContext: parsed.data.context,
    })
    return res.status(200).json({ content: out.content })
  } catch (e) {
    console.error('[hill-coach-murmur]', e instanceof Error ? e.message : e)
    // murmur é best-effort: falha não trava o ritual
    return res.status(200).json({ content: null })
  }
}
