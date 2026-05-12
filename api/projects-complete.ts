import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ProjectCompleteSchema } from './_schemas/project.js'
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

  const parsed = ProjectCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'id obrigatório' })
  }

  const supabase = getSupabase()

  const { data: existing, error: fetchErr } = await supabase
    .from('projects')
    .select('id, kind')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !existing) return res.status(404).json({ error: 'projeto não encontrado' })
  if (existing.kind === 'evergreen') {
    return res.status(400).json({ error: 'projeto evergreen não pode ser marcado concluído' })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('projects')
    .update({ status_aqal: 'done', completed_at: now, updated_at: now })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ project: mapRow(data as unknown as Record<string, unknown>) })
}
