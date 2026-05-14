import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachMemorySaveSchema } from './_schemas/coach.js'
import { mapCoachMemoryRow, type CoachMemoryRow } from './_coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachMemorySaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  const payload = {
    user_id: user.id,
    kind: d.kind,
    content: d.content,
    source: d.source ?? null,
    related_area_id: d.relatedAreaId ?? null,
    related_project_id: d.relatedProjectId ?? null,
    related_task_id: d.relatedTaskId ?? null,
    relevance: d.relevance,
    expires_at: d.expiresAt ?? null,
  }

  if (d.id) {
    const { data, error } = await supabase
      .from('coach_memory').update(payload)
      .eq('id', d.id).eq('user_id', user.id)
      .select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'memória não encontrada' })
    return res.status(200).json({ memory: mapCoachMemoryRow(data as unknown as CoachMemoryRow) })
  }

  const { data, error } = await supabase
    .from('coach_memory').insert(payload).select().single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ memory: mapCoachMemoryRow(data as unknown as CoachMemoryRow) })
}
