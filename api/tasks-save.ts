import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { TaskSaveSchema } from './_schemas/task.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { id, projectId, contactId, dueDate, dependsOn, startOffset, duration, ...rest } = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload = {
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

  if (id) {
    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({
      task: {
        id: data.id, userId: data.user_id, projectId: data.project_id,
        contactId: data.contact_id ?? undefined, title: data.title, notes: data.notes,
        status: data.status, priority: data.priority, tags: data.tags,
        dueDate: data.due_date ?? undefined, startOffset: data.start_offset ?? undefined,
        duration: data.duration ?? undefined, dependsOn: data.depends_on,
        archived: data.archived, archivedAt: data.archived_at ?? undefined,
        googleTasksId: data.google_tasks_id ?? undefined, synced: data.synced,
        createdAt: data.created_at, updatedAt: data.updated_at,
      },
    })
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(payload)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    task: {
      id: data.id, userId: data.user_id, projectId: data.project_id,
      contactId: data.contact_id ?? undefined, title: data.title, notes: data.notes,
      status: data.status, priority: data.priority, tags: data.tags,
      dueDate: data.due_date ?? undefined, startOffset: data.start_offset ?? undefined,
      duration: data.duration ?? undefined, dependsOn: data.depends_on,
      archived: data.archived, archivedAt: data.archived_at ?? undefined,
      googleTasksId: data.google_tasks_id ?? undefined, synced: data.synced,
      createdAt: data.created_at, updatedAt: data.updated_at,
    },
  })
}
