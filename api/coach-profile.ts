import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachProfileSaveSchema } from './_schemas/coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Json } from '../src/types/database.js'

function mapProfile(r: Record<string, unknown> | null) {
  if (!r) return null
  return {
    userId: r['user_id'],
    name: r['name'],
    tone: r['tone'],
    voiceExamples: r['voice_examples'] ?? undefined,
    valuesMd: r['values_md'] ?? [],
    boundaries: r['boundaries'] ?? undefined,
    checkInSchedule: r['check_in_schedule'] ?? {},
    systemPromptOverride: r['system_prompt_override'] ?? undefined,
    northStarMd: r['north_star_md'] ?? undefined,
    h3Goals: r['h3_goals'] ?? [],
    updatedAt: r['updated_at'],
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  const supabase = getSupabase()

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('coach_profile').select('*').eq('user_id', user.id).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: mapProfile(data as Record<string, unknown> | null) })
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const parsed = CoachProfileSaveSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
    }
    const d = parsed.data
    const now = new Date().toISOString()
    const payload = {
      user_id: user.id,
      name: d.name,
      tone: d.tone,
      voice_examples: d.voiceExamples ?? null,
      values_md: d.valuesMd as unknown as Json,
      boundaries: d.boundaries ?? null,
      check_in_schedule: d.checkInSchedule as unknown as Json,
      system_prompt_override: d.systemPromptOverride ?? null,
      north_star_md: d.northStarMd ?? null,
      h3_goals: d.h3Goals as unknown as Json,
      updated_at: now,
    }
    const { data, error } = await supabase
      .from('coach_profile').upsert(payload, { onConflict: 'user_id' }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: mapProfile(data as unknown as Record<string, unknown>) })
  }

  return res.status(405).end()
}
