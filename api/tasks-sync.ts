import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: userData } = await supabase
    .from('users')
    .select('google_refresh_token')
    .eq('id', user.id)
    .single()

  if (!userData?.google_refresh_token) {
    return res.status(400).json({ error: 'Google não conectado' })
  }

  const authClient = await getAuthedClient(userData.google_refresh_token)
  const tasksApi = google.tasks({ version: 'v1', auth: authClient })

  // 1. Sync task lists → projects
  const { data: taskListsData } = await tasksApi.tasklists.list({ maxResults: 100 })
  const taskLists = taskListsData.items ?? []

  const listUpserts = taskLists
    .filter(l => l.id && l.title)
    .map(l => ({
      user_id: user.id,
      name: l.title!,
      google_task_list_id: l.id!,
      updated_at: new Date().toISOString(),
    }))

  const projectIdByGoogleId = new Map<string, string>()

  if (listUpserts.length > 0) {
    const { data: projectRows, error: projErr } = await supabase
      .from('projects')
      .upsert(listUpserts, { onConflict: 'user_id,google_task_list_id' })
      .select('id, google_task_list_id')

    if (projErr) {
      console.error('[tasks-sync] project upsert error:', projErr.message)
      return res.status(500).json({ error: projErr.message })
    }

    for (const row of projectRows ?? []) {
      if (row.google_task_list_id) projectIdByGoogleId.set(row.google_task_list_id, row.id)
    }
  }

  // 2. Sync tasks per list
  const taskUpserts: object[] = []

  for (const list of taskLists) {
    if (!list.id) continue
    const projectId = projectIdByGoogleId.get(list.id)
    if (!projectId) continue

    let pageToken: string | undefined
    do {
      const { data: page } = await tasksApi.tasks.list({
        tasklist: list.id,
        maxResults: 100,
        showCompleted: true,
        showHidden: false,
        ...(pageToken ? { pageToken } : {}),
      })

      for (const t of page.items ?? []) {
        if (!t.id || !t.title) continue

        taskUpserts.push({
          user_id: user.id,
          project_id: projectId,
          title: t.title,
          notes: t.notes ?? '',
          status: t.status === 'completed' ? 'done' : 'inbox',
          due_date: t.due ?? null,
          google_tasks_id: t.id,
          synced: true,
          updated_at: new Date().toISOString(),
        })
      }

      pageToken = page.nextPageToken ?? undefined
    } while (pageToken)
  }

  if (taskUpserts.length > 0) {
    const { error: taskErr } = await supabase
      .from('tasks')
      .upsert(taskUpserts as never[], { onConflict: 'user_id,google_tasks_id' })

    if (taskErr) {
      console.error('[tasks-sync] task upsert error:', taskErr.message)
      return res.status(500).json({ error: taskErr.message })
    }
  }

  return res.status(200).json({
    projects: listUpserts.length,
    tasks: taskUpserts.length,
  })
}
