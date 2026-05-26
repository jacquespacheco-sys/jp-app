import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { GoalSaveSchema } from './_schemas/hill.js'
import { mapGoal } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = GoalSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()

  // Vínculo cross-módulo: garante que o project pertence ao usuário
  if (d.linkedProjectId) {
    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', d.linkedProjectId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (projErr) return res.status(500).json({ error: projErr.message })
    if (!proj) return res.status(400).json({ error: 'project inválido' })
  }

  const payload = {
    user_id: user.id,
    level: d.level,
    title: d.title,
    status: d.status,
    chief_aim_id: d.chiefAimId ?? null,
    parent_id: d.parentId ?? null,
    metric_text: d.metricText ?? null,
    metric_value: d.metricValue ?? null,
    metric_unit: d.metricUnit ?? null,
    deadline: d.deadline ?? null,
    linked_project_id: d.linkedProjectId ?? null,
    ...(d.progressPct != null ? { progress_pct: d.progressPct } : {}),
    updated_at: new Date().toISOString(),
  }

  if (d.id) {
    const { data, error } = await supabase
      .from('hill_goals')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ goal: mapGoal(data) })
  }

  const { data, error } = await supabase.from('hill_goals').insert(payload).select().single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ goal: mapGoal(data) })
}
