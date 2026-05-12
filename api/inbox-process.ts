import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { InboxProcessSchema } from './_schemas/inbox.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapItem(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    rawText: r['raw_text'],
    source: r['source'],
    externalRef: r['external_ref'] ?? undefined,
    aiSuggestion: r['ai_suggestion'] ?? undefined,
    processed: r['processed'],
    processedToTask: r['processed_to_task'] ?? undefined,
    processedToProject: r['processed_to_project'] ?? undefined,
    createdAt: r['created_at'],
    processedAt: r['processed_at'] ?? undefined,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = InboxProcessSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { id, action, taskFields } = parsed.data
  const supabase = getSupabase()

  const { data: item, error: itemErr } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (itemErr || !item) return res.status(404).json({ error: 'inbox_item não encontrado' })
  if (item.processed) return res.status(409).json({ error: 'item já processado' })

  const now = new Date().toISOString()

  if (action === 'trash') {
    const { data: updated, error } = await supabase
      .from('inbox_items')
      .update({ processed: true, processed_at: now })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ item: mapItem(updated as unknown as Record<string, unknown>) })
  }

  if (action === 'to_task') {
    if (!taskFields) return res.status(400).json({ error: 'taskFields obrigatório para to_task' })

    const { data: created, error: createErr } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        project_id: taskFields.projectId,
        title: taskFields.title,
        notes: '',
        status: taskFields.status,
        priority: 'med',
        tags: [],
        depends_on: [],
        area_id: taskFields.areaId ?? null,
        context: taskFields.context ?? null,
        energy: taskFields.energy ?? null,
        time_estimate_min: taskFields.timeEstimateMin ?? null,
        due_at: taskFields.dueAt ?? null,
        scheduled_at: taskFields.scheduledAt ?? null,
        waiting_for: taskFields.waitingFor ?? null,
        source: item.source,
      })
      .select()
      .single()
    if (createErr) return res.status(500).json({ error: createErr.message })

    const { data: updated, error: updErr } = await supabase
      .from('inbox_items')
      .update({ processed: true, processed_to_task: created.id, processed_at: now })
      .eq('id', id)
      .select()
      .single()
    if (updErr) return res.status(500).json({ error: updErr.message })

    return res.status(200).json({
      item: mapItem(updated as unknown as Record<string, unknown>),
      task: { id: created.id, title: created.title, status: created.status },
    })
  }

  if (action === 'to_project') {
    const { data: created, error: createErr } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: item.raw_text.slice(0, 100),
        color: '#a8ff00',
      })
      .select()
      .single()
    if (createErr) return res.status(500).json({ error: createErr.message })

    const { data: updated, error: updErr } = await supabase
      .from('inbox_items')
      .update({ processed: true, processed_to_project: created.id, processed_at: now })
      .eq('id', id)
      .select()
      .single()
    if (updErr) return res.status(500).json({ error: updErr.message })

    return res.status(200).json({ item: mapItem(updated as unknown as Record<string, unknown>) })
  }

  return res.status(400).json({ error: 'action desconhecida' })
}
