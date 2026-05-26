import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachWizardStepSchema } from './_schemas/hill.js'
import { generateCoachMessage } from './_hill-coach.js'
import type { HillCoachVoice } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 30

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachWizardStepSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const { dimension, draft } = parsed.data

  const supabase = getSupabase()
  const { data: prefs } = await supabase.from('hill_preferences').select('coach_voice').eq('user_id', user.id).maybeSingle()
  const voice = (prefs?.coach_voice ?? 'mixed') as HillCoachVoice

  try {
    const out = await generateCoachMessage({
      userId: user.id, userTimezone: user.timezone, mode: 'wizard_step', voice, dimension, draft,
    })
    return res.status(200).json({ content: out.content, action: out.action ?? null, conversationId: out.conversationId })
  } catch (e) {
    console.error('[hill-coach-wizard-step]', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'erro no coach' })
  }
}
