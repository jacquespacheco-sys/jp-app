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

  // 2. Sync tasks per list — collect all rows from Google
  type GoogleTaskRow = {
    user_id: string
    project_id: string
    title: string
    notes: string
    status: 'inbox' | 'done'
    due_date: string | null
    google_tasks_id: string
    synced: boolean
    updated_at: string
  }

  const taskRows: GoogleTaskRow[] = []

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
        taskRows.push({
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

  if (taskRows.length === 0) {
    return res.status(200).json({ projects: listUpserts.length, tasks_inserted: 0, tasks_updated: 0 })
  }

  // PASS 1: insert NEW tasks only — ignoreDuplicates evita sobrescrever existentes.
  // Tasks novas vindas do Google entram com title, notes, status, due_date completos.
  const { error: insertErr } = await supabase
    .from('tasks')
    .upsert(taskRows as never[], { onConflict: 'user_id,google_tasks_id', ignoreDuplicates: true })

  if (insertErr) {
    console.error('[tasks-sync] task insert error:', insertErr.message)
    return res.status(500).json({ error: insertErr.message })
  }

  // PASS 2: update EXISTING tasks — só campos que Google é a fonte da verdade.
  // Preserva: areaId, quadrantOverride, context, energy, timeEstimateMin, scheduledAt,
  //          waitingFor, rrule, parentTaskId, ai_classified, tags, priority, contactId.
  // Atualiza:  status (done/inbox), due_date, synced. NÃO sobrescreve title nem notes
  //           — usuário pode ter editado essas coisas localmente.
  let updated = 0
  for (const row of taskRows) {
    const { error: updErr, count } = await supabase
      .from('tasks')
      .update(
        {
          status: row.status,
          due_date: row.due_date,
          synced: true,
          updated_at: row.updated_at,
        },
        { count: 'exact' }
      )
      .eq('user_id', row.user_id)
      .eq('google_tasks_id', row.google_tasks_id)
      // só atualiza tasks que NÃO foram tocadas localmente recentemente
      // (heurística: se updated_at local > 60s no futuro de quando o Google foi consultado,
      // assume que o usuário editou agora e não sobrescreve status/due)
      // — implementação simples: sempre atualiza, mas só os campos seguros acima

    if (updErr) {
      console.error('[tasks-sync] task update error:', updErr.message, row.google_tasks_id)
      continue
    }
    if (count) updated += count
  }

  // Insertions: count rows that are now in DB but weren't before — não temos contagem direta.
  // Reportamos quantas eram pra inserir vs quantas foram atualizadas.
  const inserted = Math.max(0, taskRows.length - updated)

  return res.status(200).json({
    projects: listUpserts.length,
    tasks_inserted: inserted,
    tasks_updated: updated,
  })
}
