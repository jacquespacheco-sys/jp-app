import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { RitualCompleteSchema } from './_schemas/hill.js'
import { mapRitualLog } from './_hill.js'
import type { Database } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type RitualUpdate = Database['public']['Tables']['hill_ritual_logs']['Update']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = RitualCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()

  const { data: row, error: rowErr } = await supabase
    .from('hill_ritual_logs')
    .select('started_at, completed_at')
    .eq('id', d.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (rowErr) return res.status(500).json({ error: rowErr.message })
  if (!row) return res.status(404).json({ error: 'ritual não encontrado' })

  // Vínculo cross-módulo: a task da ação do dia precisa ser do usuário
  if (d.dailyActionTaskId) {
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', d.dailyActionTaskId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (taskErr) return res.status(500).json({ error: taskErr.message })
    if (!task) return res.status(400).json({ error: 'task inválida' })
  }

  const now = new Date()
  const duration = d.durationSeconds
    ?? Math.max(0, Math.round((now.getTime() - new Date(row.started_at).getTime()) / 1000))

  const patch: RitualUpdate = {
    completed_at: now.toISOString(),
    duration_seconds: duration,
    ...(d.stepsCompleted != null ? { steps_completed: d.stepsCompleted } : {}),
    ...(d.affirmationsRead != null ? { affirmations_read: d.affirmationsRead } : {}),
    ...(d.affirmationsSkipped != null ? { affirmations_skipped: d.affirmationsSkipped } : {}),
    ...(d.reflectionData != null ? { reflection_data: d.reflectionData } : {}),
    ...(d.gratitudeItems != null ? { gratitude_items: d.gratitudeItems } : {}),
    ...(d.dailyActionTaskId != null ? { daily_action_task_id: d.dailyActionTaskId } : {}),
  }

  const { data, error } = await supabase
    .from('hill_ritual_logs')
    .update(patch)
    .eq('id', d.id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ritual: mapRitualLog(data) })
}
