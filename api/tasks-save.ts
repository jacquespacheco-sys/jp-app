import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import { TaskSaveSchema } from './_schemas/task.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id, userId: r.user_id, projectId: r.project_id,
    contactId: r.contact_id ?? undefined, title: r.title, notes: r.notes,
    status: r.status, priority: r.priority, tags: r.tags,
    dueDate: r.due_date ?? undefined, startOffset: r.start_offset ?? undefined,
    duration: r.duration ?? undefined, dependsOn: r.depends_on,
    archived: r.archived, archivedAt: r.archived_at ?? undefined,
    googleTasksId: r.google_tasks_id ?? undefined, synced: r.synced,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { id, title, projectId, contactId, dueDate, dependsOn, startOffset, duration, ...rest } = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload = {
    title,
    ...rest,
    project_id: projectId,
    contact_id: contactId ?? null,
    due_date: dueDate ?? null,
    depends_on: dependsOn,
    start_offset: startOffset ?? null,
    duration: duration ?? null,
    user_id: user.id,
    updated_at: now,
  }

  let row: Record<string, unknown>
  let httpStatus: number

  if (id) {
    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
    httpStatus = 201
  }

  // Push to Google Tasks (best-effort — save already succeeded)
  try {
    const [projRes, userRes] = await Promise.all([
      supabase.from('projects').select('google_task_list_id').eq('id', projectId).eq('user_id', user.id).single(),
      supabase.from('users').select('google_refresh_token').eq('id', user.id).single(),
    ])
    const taskListId = projRes.data?.google_task_list_id
    const refreshToken = userRes.data?.google_refresh_token

    if (taskListId && refreshToken) {
      const authClient = await getAuthedClient(refreshToken)
      const tasksApi = google.tasks({ version: 'v1', auth: authClient })

      const googleStatus = rest.status === 'done' ? 'completed' : 'needsAction'
      const body = {
        title,
        notes: rest.notes ?? undefined,
        status: googleStatus,
        due: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
      }

      const existingGoogleTaskId = row['google_tasks_id'] as string | null

      if (id && existingGoogleTaskId) {
        await tasksApi.tasks.patch({ tasklist: taskListId, task: existingGoogleTaskId, requestBody: body })
        await supabase.from('tasks').update({ synced: true }).eq('id', row['id'] as string)
        row['synced'] = true
      } else if (!id) {
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
