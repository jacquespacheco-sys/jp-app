import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachMemorySaveSchema } from './_schemas/coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapMemory(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    kind: r['kind'],
    content: r['content'],
    source: r['source'] ?? undefined,
    relatedAreaId: r['related_area_id'] ?? undefined,
    relatedProjectId: r['related_project_id'] ?? undefined,
    relatedTaskId: r['related_task_id'] ?? undefined,
    relevance: r['relevance'],
    expiresAt: r['expires_at'] ?? undefined,
    lastReferencedAt: r['last_referenced_at'] ?? undefined,
    createdAt: r['created_at'],
  }
}

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

  let row: Record<string, unknown>
  let httpStatus: number

  if (d.id) {
    const { data, error } = await supabase
      .from('coach_memory').update(payload)
      .eq('id', d.id).eq('user_id', user.id)
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('coach_memory').insert(payload).select().single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 201
  }

  return res.status(httpStatus).json({ memory: mapMemory(row) })
}
