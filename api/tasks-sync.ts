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

  // 2. Pull tasks per list
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
  const googleUpdatedById = new Map<string, string>()

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
        showHidden: true,
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
        if (t.updated) googleUpdatedById.set(t.id, t.updated)
      }

      pageToken = page.nextPageToken ?? undefined
    } while (pageToken)
  }

  console.log(`[tasks-sync] pulled ${taskRows.length} tasks from Google across ${listUpserts.length} lists`)

  if (taskRows.length === 0) {
    return res.status(200).json({ projects: listUpserts.length, tasks_inserted: 0, tasks_updated: 0, tasks_unchanged: 0 })
  }

  // PASS 1: insere só tasks novas E não-concluídas. Como agora pedimos
  // showHidden:true, conclusões históricas do Google (que o app nunca teve) viriam
  // junto — não as importamos pra não floodar o app de "done" antigos. Conclusões
  // de tasks que o app JÁ conhece são aplicadas no PASS 2.
  const newRows = taskRows.filter(r => r.status !== 'done')
  if (newRows.length > 0) {
    const { error: insertErr } = await supabase
      .from('tasks')
      .upsert(newRows as never[], { onConflict: 'user_id,google_tasks_id', ignoreDuplicates: true })

    if (insertErr) {
      console.error('[tasks-sync] task insert error:', insertErr.message)
      return res.status(500).json({ error: insertErr.message })
    }
  }

  // PASS 2: smart merge para tasks já existentes.
  // Busca o estado local pra decidir o que atualizar baseado em:
  //   - completion delta (Google done → local done; vice-versa só se local não foi tocado depois)
  //   - timestamps (updated_at local vs google.updated)
  // Preserva status granular (next/doing/blocked/waiting/scheduled/someday) quando
  // o Google só diz needsAction — o app tem mais granularidade que o Google.
  // Busca TODAS as tasks já vinculadas ao Google (não um .in() com a lista de ids
  // puxados — com showHidden:true essa lista fica enorme e estoura o limite de URL,
  // fazendo a query falhar e o merge não aplicar nada).
  const { data: existingRows, error: existingErr } = await supabase
    .from('tasks')
    .select('id, google_tasks_id, status, due_date, updated_at, archived, title, notes')
    .eq('user_id', user.id)
    .not('google_tasks_id', 'is', null)
  if (existingErr) {
    console.error('[tasks-sync] existing fetch error:', existingErr.message)
    return res.status(500).json({ error: existingErr.message })
  }

  const localByGoogleId = new Map<string, {
    id: string; status: string; due_date: string | null; updated_at: string; archived: boolean; title: string; notes: string | null
  }>()
  for (const r of (existingRows ?? []) as Array<{
    id: string; google_tasks_id: string; status: string; due_date: string | null; updated_at: string; archived: boolean; title: string; notes: string | null
  }>) {
    localByGoogleId.set(r.google_tasks_id, r)
  }

  let updated = 0
  let unchanged = 0
  const inserted = newRows.length

  for (const row of taskRows) {
    const local = localByGoogleId.get(row.google_tasks_id)
    if (!local) continue  // novas não-done já entraram no PASS 1; done-históricas são ignoradas

    if (local.archived) {
      // Local archivado — Google ainda mostra. Push delete pra Google (best-effort).
      const taskListId = taskLists.find(l => l.id && projectIdByGoogleId.get(l.id) === row.project_id)?.id
      if (taskListId) {
        try {
          await tasksApi.tasks.delete({ tasklist: taskListId, task: row.google_tasks_id })
          console.log(`[tasks-sync] deleted from Google: ${row.google_tasks_id} (was archived locally)`)
        } catch (e) {
          console.warn('[tasks-sync] delete failed:', e instanceof Error ? e.message : e)
        }
      }
      continue
    }

    // Decide se Google é "mais novo": se google.updated > local.updated_at, sim.
    const gUpdated = googleUpdatedById.get(row.google_tasks_id)
    const googleNewer = !!gUpdated && gUpdated > local.updated_at

    // Status merge inteligente:
    // - Google done && local !done → trazer pra done
    // - Google needsAction && local done → reabrir como 'next' (não 'inbox')
    // - Google needsAction && local granular (next/doing/etc) → manter local
    let nextStatus: 'done' | 'next' | null = null
    if (row.status === 'done' && local.status !== 'done' && local.status !== 'cancelled') {
      if (googleNewer) nextStatus = 'done'
    } else if (row.status === 'inbox' && local.status === 'done') {
      if (googleNewer) nextStatus = 'next'
    }

    // Due / título / notas: só aplicam se o Google é mais novo (last-write-wins
    // por timestamp; não sobrescreve edição local mais recente).
    const dueChanged = googleNewer && row.due_date !== local.due_date
    const nextDue = dueChanged ? row.due_date : undefined
    const titleChanged = googleNewer && row.title !== local.title
    const notesChanged = googleNewer && (row.notes ?? '') !== (local.notes ?? '')

    const update: { status?: 'done' | 'next'; due_date?: string | null; title?: string; notes?: string; synced: boolean; updated_at?: string } = {
      synced: true,
    }
    if (nextStatus) update.status = nextStatus
    if (nextDue !== undefined) update.due_date = nextDue
    if (titleChanged) update.title = row.title
    if (notesChanged) update.notes = row.notes

    if (update.status || update.due_date !== undefined || update.title !== undefined || update.notes !== undefined) {
      update.updated_at = new Date().toISOString()
      const { error: updErr } = await supabase
        .from('tasks')
        .update(update)
        .eq('user_id', user.id)
        .eq('google_tasks_id', row.google_tasks_id)
      if (updErr) {
        console.error('[tasks-sync] task update error:', updErr.message, row.google_tasks_id)
        continue
      }
      updated++
    } else {
      // Só marca como synced (sem mexer em updated_at pra não invalidar conflitos futuros)
      await supabase
        .from('tasks')
        .update({ synced: true })
        .eq('user_id', user.id)
        .eq('google_tasks_id', row.google_tasks_id)
      unchanged++
    }
  }

  console.log(`[tasks-sync] inserted=${inserted} updated=${updated} unchanged=${unchanged}`)

  return res.status(200).json({
    projects: listUpserts.length,
    tasks_pulled: taskRows.length,
    tasks_inserted: inserted,
    tasks_updated: updated,
    tasks_unchanged: unchanged,
  })
}
