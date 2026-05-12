import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ProjectSaveSchema } from './_schemas/project.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    name: r['name'],
    color: r['color'],
    googleTaskListId: r['google_task_list_id'] ?? undefined,
    archived: r['archived'],
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
    title: r['title'] ?? undefined,
    outcome: r['outcome'] ?? undefined,
    kind: r['kind'] ?? 'outcome',
    status: r['status_aqal'] ?? 'active',
    horizon: r['horizon'] ?? 'H1',
    areaId: r['area_id'] ?? undefined,
    parentId: r['parent_id'] ?? undefined,
    quadrantOverride: r['quadrant_override'] ?? undefined,
    resolvedQuadrant: undefined,
    targetDate: r['target_date'] ?? undefined,
    position: r['position'] ?? 0,
    completedAt: r['completed_at'] ?? undefined,
    archivedAt: r['archived_at'] ?? undefined,
    taskCount: 0,
    taskOpenCount: 0,
    childCount: 0,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ProjectSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  if (d.parentId) {
    const { data: parent, error: parentErr } = await supabase
      .from('projects')
      .select('id, parent_id')
      .eq('id', d.parentId)
      .eq('user_id', user.id)
      .single()
    if (parentErr || !parent) {
      return res.status(400).json({ error: 'projeto pai não encontrado' })
    }
    if (parent.parent_id) {
      return res.status(400).json({ error: 'hierarquia limitada a 1 nível (pai não pode ter parent)' })
    }
    if (d.id && d.parentId === d.id) {
      return res.status(400).json({ error: 'projeto não pode ser pai de si mesmo' })
    }
  }

  const now = new Date().toISOString()
  const payload = {
    name: d.name,
    ...(d.title !== undefined ? { title: d.title } : {}),
    outcome: d.outcome ?? null,
    color: d.color,
    kind: d.kind,
    status_aqal: d.status,
    horizon: d.horizon,
    area_id: d.areaId ?? null,
    parent_id: d.parentId ?? null,
    quadrant_override: d.quadrantOverride ?? null,
    target_date: d.targetDate ?? null,
    position: d.position,
    user_id: user.id,
    updated_at: now,
  }

  let row: Record<string, unknown>
  let httpStatus: number

  if (d.id) {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 201
  }

  return res.status(httpStatus).json({ project: mapRow(row) })
}
