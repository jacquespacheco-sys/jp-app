import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
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
    resolvedQuadrant: r['resolved_quadrant'] ?? undefined,
    targetDate: r['target_date'] ?? undefined,
    position: r['position'] ?? 0,
    completedAt: r['completed_at'] ?? undefined,
    archivedAt: r['archived_at'] ?? undefined,
    taskCount: r['task_count'] ?? 0,
    taskOpenCount: r['task_open_count'] ?? 0,
    childCount: r['child_count'] ?? 0,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const statusFilter = typeof req.query['status'] === 'string' ? req.query['status'] : undefined
  const supabase = getSupabase()

  let query = supabase
    .from('v_projects_with_counts')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (statusFilter === 'archived') {
    query = query.not('archived_at', 'is', null)
  } else if (statusFilter && ['active', 'on_hold', 'someday', 'done'].includes(statusFilter)) {
    query = query.eq('status_aqal', statusFilter as 'active' | 'on_hold' | 'someday' | 'done').is('archived_at', null)
  } else {
    query = query.is('archived_at', null)
  }

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })

  let projects = (data ?? []).map(r => mapRow(r as unknown as Record<string, unknown>))

  // Garante pelo menos 1 projeto "Inbox" pra primeiro use
  if (projects.length === 0 && !statusFilter) {
    const { data: inbox, error: createErr } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: 'Inbox', color: '#7dd3fc' })
      .select()
      .single()
    if (createErr) return res.status(500).json({ error: createErr.message })
    projects = [mapRow({
      id: inbox.id,
      user_id: inbox.user_id,
      name: inbox.name,
      color: inbox.color,
      archived: inbox.archived,
      created_at: inbox.created_at,
      updated_at: inbox.updated_at,
      kind: 'outcome',
      status_aqal: 'active',
      horizon: 'H1',
      position: 0,
      task_count: 0,
      task_open_count: 0,
      child_count: 0,
    })]
  }

  return res.status(200).json({ projects })
}
