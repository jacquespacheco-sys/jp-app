import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRitual(r: Record<string, unknown>, steps: Record<string, unknown>[]) {
  return {
    id: r['id'],
    userId: r['user_id'],
    name: r['name'],
    triggerTime: r['trigger_time'] ?? undefined,
    description: r['description'] ?? undefined,
    active: r['active'],
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
    steps: steps
      .filter(s => s['ritual_id'] === r['id'])
      .sort((a, b) => (a['position'] as number) - (b['position'] as number))
      .map(s => ({
        id: s['id'],
        position: s['position'],
        habitId: s['habit_id'] ?? undefined,
        customStep: s['custom_step'] ?? undefined,
        estimatedMin: s['estimated_min'] ?? undefined,
      })),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  const { data: rituals, error: rErr } = await supabase
    .from('rituals')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: true })

  if (rErr) return res.status(500).json({ error: rErr.message })

  const ritualIds = (rituals ?? []).map(r => r.id)
  if (ritualIds.length === 0) {
    return res.status(200).json({ rituals: [] })
  }

  const { data: steps, error: sErr } = await supabase
    .from('ritual_steps')
    .select('*')
    .in('ritual_id', ritualIds)

  if (sErr) return res.status(500).json({ error: sErr.message })

  const stepsArr = (steps ?? []) as unknown as Record<string, unknown>[]
  const result = (rituals ?? []).map(r => mapRitual(r as unknown as Record<string, unknown>, stepsArr))

  return res.status(200).json({ rituals: result })
}
