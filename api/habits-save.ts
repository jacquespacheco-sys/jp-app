import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { HabitSaveSchema } from './_schemas/habit.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Json } from '../src/types/database.js'

function mapHabit(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    areaId: r['area_id'] ?? undefined,
    identity: r['identity'],
    title: r['title'],
    action: r['action'],
    minDose: r['min_dose'],
    cue: r['cue'] ?? undefined,
    reward: r['reward'] ?? undefined,
    quadrant: r['quadrant'],
    cadence: r['cadence'],
    scheduleTime: r['schedule_time'] ?? undefined,
    stackAfterHabitId: r['stack_after_habit_id'] ?? undefined,
    active: r['active'],
    archivedAt: r['archived_at'] ?? undefined,
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = HabitSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload = {
    user_id: user.id,
    area_id: d.areaId ?? null,
    identity: d.identity,
    title: d.title,
    action: d.action,
    min_dose: d.minDose,
    cue: d.cue ?? null,
    reward: d.reward ?? null,
    quadrant: d.quadrant,
    cadence: d.cadence as unknown as Json,
    schedule_time: d.scheduleTime ?? null,
    stack_after_habit_id: d.stackAfterHabitId ?? null,
    active: d.active,
    updated_at: now,
  }

  let row: Record<string, unknown>
  let httpStatus: number

  if (d.id) {
    const { data, error } = await supabase
      .from('habits').update(payload)
      .eq('id', d.id).eq('user_id', user.id)
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('habits').insert(payload)
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 201
  }

  return res.status(httpStatus).json({ habit: mapHabit(row) })
}
