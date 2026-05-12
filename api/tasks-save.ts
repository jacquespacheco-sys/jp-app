import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import { TaskSaveSchema } from './_schemas/task.js'
import { nextOccurrence } from './_lib/rrule.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r['id'], userId: r['user_id'], projectId: r['project_id'],
    contactId: r['contact_id'] ?? undefined, title: r['title'], notes: r['notes'],
    status: r['status'], priority: r['priority'], tags: r['tags'],
    dueDate: r['due_date'] ?? undefined, startOffset: r['start_offset'] ?? undefined,
    duration: r['duration'] ?? undefined, dependsOn: r['depends_on'],
    archived: r['archived'], archivedAt: r['archived_at'] ?? undefined,
    googleTasksId: r['google_tasks_id'] ?? undefined, synced: r['synced'],
    createdAt: r['created_at'], updatedAt: r['updated_at'],
    areaId: r['area_id'] ?? undefined,
    quadrantOverride: r['quadrant_override'] ?? undefined,
    context: r['context'] ?? undefined,
    energy: r['energy'] ?? undefined,
    timeEstimateMin: r['time_estimate_min'] ?? undefined,
    dueAt: r['due_at'] ?? undefined,
    scheduledAt: r['scheduled_at'] ?? undefined,
    completedAt: r['completed_at'] ?? undefined,
    waitingFor: r['waiting_for'] ?? undefined,
    rrule: r['rrule'] ?? undefined,
    rruleParentId: r['rrule_parent_id'] ?? undefined,
    parentTaskId: r['parent_task_id'] ?? undefined,
    source: r['source'] ?? 'manual',
    aiClassified: r['ai_classified'] ?? false,
  }
}

function mapStatusToGoogle(status: string): 'needsAction' | 'completed' {
  if (status === 'done' || status === 'cancelled') return 'completed'
  return 'needsAction'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload = {
    title: d.title,
    notes: d.notes,
    status: d.status,
    priority: d.priority,
    tags: d.tags,
    project_id: d.projectId,
    contact_id: d.contactId ?? null,
    due_date: d.dueDate ?? null,
    depends_on: d.dependsOn,
    start_offset: d.startOffset ?? null,
    duration: d.duration ?? null,
    area_id: d.areaId ?? null,
    quadrant_override: d.quadrantOverride ?? null,
    context: d.context ?? null,
    energy: d.energy ?? null,
    time_estimate_min: d.timeEstimateMin ?? null,
    due_at: d.dueAt ?? null,
    scheduled_at: d.scheduledAt ?? null,
    waiting_for: d.waitingFor ?? null,
    rrule: d.rrule ?? null,
    parent_task_id: d.parentTaskId ?? null,
    source: d.source,
    user_id: user.id,
    updated_at: now,
  }

  let row: Record<string, unknown>
  let httpStatus: number

  if (d.id) {
    const { data, error } = await supabase
      .from('tasks')
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
      .from('tasks')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 201
  }

  // Recorrência: se foi pra done com rrule, gera próxima instância (idempotente)
  if (d.status === 'done' && row['rrule']) {
    await maybeGenerateNextInstance(supabase, row, user.id)
  }

  // Google Tasks push (best-effort)
  try {
    const [projRes, userRes] = await Promise.all([
      supabase.from('projects').select('google_task_list_id').eq('id', d.projectId).eq('user_id', user.id).single(),
      supabase.from('users').select('google_refresh_token').eq('id', user.id).single(),
    ])
    const taskListId = projRes.data?.google_task_list_id
    const refreshToken = userRes.data?.google_refresh_token

    if (taskListId && refreshToken) {
      const authClient = await getAuthedClient(refreshToken)
      const tasksApi = google.tasks({ version: 'v1', auth: authClient })

      const body = {
        title: d.title,
        notes: d.notes ?? undefined,
        status: mapStatusToGoogle(d.status),
        due: d.dueDate ? `${d.dueDate}T00:00:00.000Z` : undefined,
      }

      const existingGoogleTaskId = row['google_tasks_id'] as string | null

      if (d.id && existingGoogleTaskId) {
        await tasksApi.tasks.patch({ tasklist: taskListId, task: existingGoogleTaskId, requestBody: body })
        await supabase.from('tasks').update({ synced: true }).eq('id', row['id'] as string)
        row['synced'] = true
      } else if (!d.id) {
        const { data: gtask } = await tasksApi.tasks.insert({ tasklist: taskListId, requestBody: body })
        if (gtask?.id) {
          await supabase
            .from('tasks')
            .update({ google_tasks_id: gtask.id, synced: true })
            .eq('id', row['id'] as string)
          row['google_tasks_id'] = gtask.id
          row['synced'] = true
        }
      }
    }
  } catch (e) {
    console.error('[tasks-save] google push failed:', e instanceof Error ? e.message : e)
  }

  return res.status(httpStatus).json({ task: mapRow(row) })
}

async function maybeGenerateNextInstance(
  supabase: ReturnType<typeof getSupabase>,
  parentRow: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const rule = (parentRow['rrule'] ?? null) as string | null
  if (!rule) return
  const parentId = parentRow['id'] as string
  const ruleParentId = (parentRow['rrule_parent_id'] as string | null) ?? parentId

  // Idempotência: já existe outra instância open na mesma série?
  const { data: existing, error: existingErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('rrule_parent_id', ruleParentId)
    .not('status', 'in', '(done,cancelled)')
    .limit(1)

  if (existingErr) {
    console.error('[rrule-gen] check existing failed:', existingErr.message)
    return
  }
  if (existing && existing.length > 0) return

  // Calcula próxima ocorrência
  const baseDate = (parentRow['due_at'] as string | null)
    ? new Date(parentRow['due_at'] as string)
    : new Date()
  const next = nextOccurrence(rule, baseDate)
  if (!next) {
    console.log('[rrule-gen] no next occurrence — series ended')
    return
  }

  const insertPayload = {
    user_id: userId,
    project_id: parentRow['project_id'] as string,
    title: parentRow['title'] as string,
    notes: (parentRow['notes'] as string | null) ?? '',
    status: 'next' as const,
    priority: ((parentRow['priority'] as string | null) ?? 'med') as 'high' | 'med' | 'low',
    tags: (parentRow['tags'] as string[] | null) ?? [],
    depends_on: [],
    area_id: (parentRow['area_id'] as string | null) ?? null,
    quadrant_override: (parentRow['quadrant_override'] as 'I' | 'IT' | 'WE' | 'ITS' | null) ?? null,
    context: (parentRow['context'] as 'deep' | 'shallow' | 'social' | 'criativo' | 'somatico' | 'offline' | null) ?? null,
    energy: (parentRow['energy'] as number | null) ?? null,
    time_estimate_min: (parentRow['time_estimate_min'] as number | null) ?? null,
    due_at: next.toISOString(),
    rrule: rule,
    rrule_parent_id: ruleParentId,
    source: 'manual' as const,
  }

  const { error: insErr } = await supabase.from('tasks').insert(insertPayload)
  if (insErr) {
    console.error('[rrule-gen] insert next instance failed:', insErr.message)
    return
  }
  console.log(`[rrule-gen] next instance created for series ${ruleParentId}, due_at=${next.toISOString()}`)
}
