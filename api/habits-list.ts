import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const includeInactive = req.query['inactive'] === 'true'
  const supabase = getSupabase()

  let query = supabase
    .from('habits')
    .select('*')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('created_at', { ascending: true })

  if (!includeInactive) query = query.eq('active', true)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const habits = (data ?? []).map(r => mapHabit(r as unknown as Record<string, unknown>))
  return res.status(200).json({ habits })
}
