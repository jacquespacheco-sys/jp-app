import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import { TaskArchiveSchema } from './_schemas/task.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskArchiveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'id obrigatório' })

  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data: row, error } = await supabase
    .from('tasks')
    .update({ archived: true, archived_at: now, updated_at: now })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select('id, google_tasks_id, project_id')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // Google push (best-effort): se task tinha google_tasks_id, deleta no Google
  try {
    const googleTasksId = (row as { google_tasks_id: string | null }).google_tasks_id
    const projectId = (row as { project_id: string }).project_id
    if (googleTasksId && projectId) {
      const [projRes, userRes] = await Promise.all([
        supabase.from('projects').select('google_task_list_id').eq('id', projectId).eq('user_id', user.id).single(),
        supabase.from('users').select('google_refresh_token').eq('id', user.id).single(),
      ])
      const taskListId = projRes.data?.google_task_list_id
      const refreshToken = userRes.data?.google_refresh_token
      if (taskListId && refreshToken) {
        const authClient = await getAuthedClient(refreshToken)
        const tasksApi = google.tasks({ version: 'v1', auth: authClient })
        await tasksApi.tasks.delete({ tasklist: taskListId, task: googleTasksId })
      }
    }
  } catch (e) {
    console.error('[tasks-archive] google delete failed:', e instanceof Error ? e.message : e)
  }

  return res.status(200).json({ ok: true })
}
