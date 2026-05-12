import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('v_tasks_resolved')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const tasks = (data ?? []).map(r => ({
    id: r.id,
    userId: r.user_id,
    projectId: r.project_id,
    contactId: r.contact_id ?? undefined,
    title: r.title,
    notes: r.notes,
    status: r.status,
    priority: r.priority,
    tags: r.tags,
    dueDate: r.due_date ?? undefined,
    startOffset: r.start_offset ?? undefined,
    duration: r.duration ?? undefined,
    dependsOn: r.depends_on,
    archived: r.archived,
    archivedAt: r.archived_at ?? undefined,
    googleTasksId: r.google_tasks_id ?? undefined,
    synced: r.synced,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    // AQAL/GTD
    areaId: r.area_id ?? undefined,
    quadrantOverride: r.quadrant_override ?? undefined,
    resolvedQuadrant: r.resolved_quadrant ?? undefined,
    context: r.context ?? undefined,
    energy: r.energy ?? undefined,
    timeEstimateMin: r.time_estimate_min ?? undefined,
    dueAt: r.due_at ?? undefined,
    scheduledAt: r.scheduled_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    waitingFor: r.waiting_for ?? undefined,
    rrule: r.rrule ?? undefined,
    rruleParentId: r.rrule_parent_id ?? undefined,
    parentTaskId: r.parent_task_id ?? undefined,
    source: r.source ?? 'manual',
    aiClassified: r.ai_classified ?? false,
  }))

  return res.status(200).json({ tasks })
}
