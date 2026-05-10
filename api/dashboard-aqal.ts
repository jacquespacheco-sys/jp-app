import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { Quadrant } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const QUADRANTS: Quadrant[] = ['I', 'IT', 'WE', 'ITS']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [resolvedRes, areasRes] = await Promise.all([
    supabase.from('v_tasks_resolved')
      .select('id,user_id,area_id,project_id,status,completed_at,resolved_quadrant,time_estimate_min')
      .eq('user_id', user.id),
    supabase.from('areas')
      .select('id,name,quadrant')
      .eq('user_id', user.id)
      .is('archived_at', null),
  ])

  if (resolvedRes.error) return res.status(500).json({ error: resolvedRes.error.message })
  if (areasRes.error) return res.status(500).json({ error: areasRes.error.message })

  const tasks = resolvedRes.data ?? []
  const areas = areasRes.data ?? []

  const byQuadrantMap = new Map<Quadrant, { completed: number; minutes: number }>(
    QUADRANTS.map(q => [q, { completed: 0, minutes: 0 }])
  )
  for (const t of tasks) {
    if (!t.resolved_quadrant) continue
    if (t.completed_at && t.completed_at >= sevenDaysAgo) {
      const acc = byQuadrantMap.get(t.resolved_quadrant)!
      acc.completed += 1
      acc.minutes += t.time_estimate_min ?? 0
    }
  }
  const byQuadrant = QUADRANTS.map(q => ({ quadrant: q, ...byQuadrantMap.get(q)! }))

  const byAreaMap = new Map<string, { name: string; quadrant: Quadrant; completed: number; open: number }>()
  for (const a of areas) {
    byAreaMap.set(a.id, { name: a.name, quadrant: a.quadrant, completed: 0, open: 0 })
  }
  for (const t of tasks) {
    const aid = t.area_id
    if (!aid) continue
    const acc = byAreaMap.get(aid)
    if (!acc) continue
    if (t.completed_at && t.completed_at >= sevenDaysAgo) acc.completed += 1
    if (t.status !== 'done' && t.status !== 'cancelled') acc.open += 1
  }
  const byArea = Array.from(byAreaMap.entries()).map(([areaId, v]) => ({ areaId, ...v }))

  const totals = {
    completedThisWeek: byQuadrant.reduce((s, q) => s + q.completed, 0),
    minutesThisWeek: byQuadrant.reduce((s, q) => s + q.minutes, 0),
    openTasks: tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
  }

  return res.status(200).json({ byQuadrant, byArea, totals })
}
