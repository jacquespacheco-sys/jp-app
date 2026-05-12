import { getSupabase } from './_supabase.js'

export interface AqalQuadrantSnapshot { quadrant: string; completed: number; minutes: number }
export interface AqalAreaSnapshot { areaId: string; name: string; quadrant: string; open: number }
export interface AqalProjectSnapshot { id: string; name: string; horizon: string; openTasks: number; pct: number }
export interface AqalContextSnapshot {
  quadrants7d: AqalQuadrantSnapshot[]
  areasOpen: AqalAreaSnapshot[]
  topProjects: AqalProjectSnapshot[]
  totals: { openTasks: number; completedThisWeek: number }
}

export async function fetchAqalContext(userId: string): Promise<AqalContextSnapshot> {
  const supabase = getSupabase()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [resolvedRes, areasRes, projectsRes] = await Promise.all([
    supabase.from('v_tasks_resolved')
      .select('user_id,area_id,status,completed_at,resolved_quadrant,time_estimate_min')
      .eq('user_id', userId),
    supabase.from('areas')
      .select('id,name,quadrant')
      .eq('user_id', userId)
      .is('archived_at', null),
    supabase.from('v_projects_with_counts')
      .select('id,name,horizon,task_count,task_open_count,status_aqal')
      .eq('user_id', userId)
      .is('archived_at', null)
      .eq('status_aqal', 'active')
      .order('position', { ascending: true })
      .limit(10),
  ])

  type Row = {
    user_id: string; area_id: string | null; status: string;
    completed_at: string | null; resolved_quadrant: string | null;
    time_estimate_min: number | null;
  }
  const tasks = (resolvedRes.data ?? []) as Row[]
  const areas = areasRes.data ?? []
  const projectsRaw = projectsRes.data ?? []

  const QUADS = ['I', 'IT', 'WE', 'ITS'] as const
  const byQuadMap = new Map<string, { completed: number; minutes: number }>(
    QUADS.map(q => [q, { completed: 0, minutes: 0 }])
  )
  for (const t of tasks) {
    if (!t.resolved_quadrant) continue
    if (t.completed_at && t.completed_at >= sevenDaysAgo) {
      const acc = byQuadMap.get(t.resolved_quadrant)
      if (acc) { acc.completed += 1; acc.minutes += t.time_estimate_min ?? 0 }
    }
  }
  const quadrants7d: AqalQuadrantSnapshot[] = QUADS.map(q => ({ quadrant: q, ...byQuadMap.get(q)! }))

  const areaOpenMap = new Map<string, number>()
  for (const t of tasks) {
    if (!t.area_id) continue
    if (t.status !== 'done' && t.status !== 'cancelled') {
      areaOpenMap.set(t.area_id, (areaOpenMap.get(t.area_id) ?? 0) + 1)
    }
  }
  const areasOpen: AqalAreaSnapshot[] = areas
    .map(a => ({ areaId: a.id, name: a.name, quadrant: a.quadrant, open: areaOpenMap.get(a.id) ?? 0 }))
    .filter(a => a.open > 0)
    .sort((a, b) => b.open - a.open)

  type ProjRow = { id: string; name: string; horizon: string; task_count: number; task_open_count: number; status_aqal: string }
  const topProjects: AqalProjectSnapshot[] = (projectsRaw as unknown as ProjRow[])
    .map(p => {
      const total = p.task_count
      const done = total - p.task_open_count
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      return { id: p.id, name: p.name, horizon: p.horizon, openTasks: p.task_open_count, pct }
    })
    .filter(p => p.openTasks > 0)
    .slice(0, 5)

  return {
    quadrants7d, areasOpen, topProjects,
    totals: {
      openTasks: tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
      completedThisWeek: quadrants7d.reduce((s, q) => s + q.completed, 0),
    },
  }
}
