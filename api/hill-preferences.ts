import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { HillPreferencesSchema } from './_schemas/hill.js'
import type { Database } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type Row = Database['public']['Tables']['hill_preferences']['Row']

const DEFAULTS = {
  coachVoice: 'mixed' as const,
  dailyNudgeEnabled: true,
  ritualMurmursEnabled: true,
  disabledCategories: [] as string[],
  nudgeHour: 8,
}

function mapPrefs(r: Row) {
  return {
    coachVoice: r.coach_voice,
    dailyNudgeEnabled: r.daily_nudge_enabled,
    ritualMurmursEnabled: r.ritual_murmurs_enabled,
    disabledCategories: r.disabled_categories,
    nudgeHour: r.nudge_hour,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('hill_preferences').select('*').eq('user_id', user.id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ preferences: data ? mapPrefs(data) : DEFAULTS })
  }

  if (req.method === 'PATCH' || req.method === 'POST') {
    const parsed = HillPreferencesSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
    }
    const d = parsed.data
    const payload = {
      user_id: user.id,
      ...(d.coachVoice !== undefined ? { coach_voice: d.coachVoice } : {}),
      ...(d.dailyNudgeEnabled !== undefined ? { daily_nudge_enabled: d.dailyNudgeEnabled } : {}),
      ...(d.ritualMurmursEnabled !== undefined ? { ritual_murmurs_enabled: d.ritualMurmursEnabled } : {}),
      ...(d.disabledCategories !== undefined ? { disabled_categories: d.disabledCategories } : {}),
      ...(d.nudgeHour !== undefined ? { nudge_hour: d.nudgeHour } : {}),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('hill_preferences')
      .upsert(payload, { onConflict: 'user_id' }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ preferences: mapPrefs(data) })
  }

  return res.status(405).end()
}
