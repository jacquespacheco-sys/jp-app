import { getSupabase } from './_supabase.js'
import { formatInTimeZone } from 'date-fns-tz'

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
      .eq('user_id', userId)
      .eq('archived', false),
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

// ============================================================
// Carnegie context (0014 + 0015)
// ============================================================

export interface BirthdayToday {
  contactId: string
  firstName: string
  lastName: string | null
  birthday: string
}

export interface SpecialDateToday {
  id: string
  contactId: string
  contactFirstName: string
  contactLastName: string | null
  label: string
  type: 'celebrate' | 'acknowledge' | 'silence' | 'check_in'
}

export interface LoopToClose {
  id: string
  fromContactId: string
  fromFirstName: string
  fromLastName: string | null
  context: string
  ageDays: number
}

export interface PrincipleOfMonthSnapshot {
  principle: string
  month: string
  targetApplications: number
  reflection: string | null
}

export interface CarnegieContextSnapshot {
  birthdaysToday: BirthdayToday[]
  specialDatesToday: SpecialDateToday[]
  loopsToClose: LoopToClose[]
  principleOfMonth: PrincipleOfMonthSnapshot | null
}

export async function fetchCarnegieContext(userId: string, timezone?: string): Promise<CarnegieContextSnapshot> {
  const supabase = getSupabase()
  let tz = timezone
  if (!tz) {
    const { data: u } = await supabase.from('users').select('timezone').eq('id', userId).single()
    tz = (u?.timezone as string | undefined) ?? 'America/Sao_Paulo'
  }
  const now = new Date()
  const ddmm = formatInTimeZone(now, tz, 'dd/MM')
  const fullDate = formatInTimeZone(now, tz, 'yyyy-MM-dd')
  const month = formatInTimeZone(now, tz, 'yyyy-MM')
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 86400000).toISOString()

  const [birthdaysRes, specialDatesRes, loopsRes, principleRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name, birthday')
      .eq('user_id', userId)
      .eq('archived', false)
      .eq('birthday', ddmm),
    supabase
      .from('special_dates')
      .select('id, contact_id, label, type, contacts:contact_id(first_name, last_name)')
      .eq('user_id', userId)
      .in('type', ['celebrate', 'check_in'])
      .or(`date_anniversary.eq.${ddmm},date_full.eq.${fullDate}`),
    supabase
      .from('referrals')
      .select('id, from_contact_id, context, created_at, contacts:from_contact_id(first_name, last_name)')
      .eq('user_id', userId)
      .eq('status', 'open')
      .eq('feedback_given', false)
      .lte('created_at', thirtyDaysAgoIso),
    supabase
      .from('principle_of_month')
      .select('principle, month, target_applications, reflection')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle(),
  ])

  const birthdaysToday: BirthdayToday[] = (birthdaysRes.data ?? []).map(r => {
    const row = r as { id: string; first_name: string; last_name: string | null; birthday: string }
    return {
      contactId: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      birthday: row.birthday,
    }
  })

  type SdRow = {
    id: string; contact_id: string; label: string; type: string
    contacts: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null
  }
  const specialDatesToday: SpecialDateToday[] = (specialDatesRes.data ?? []).map(r => {
    const row = r as unknown as SdRow
    const c = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts
    return {
      id: row.id,
      contactId: row.contact_id,
      contactFirstName: c?.first_name ?? '',
      contactLastName: c?.last_name ?? null,
      label: row.label,
      type: row.type as SpecialDateToday['type'],
    }
  })

  type LoopRow = {
    id: string; from_contact_id: string; context: string; created_at: string
    contacts: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null
  }
  const loopsToClose: LoopToClose[] = (loopsRes.data ?? []).map(r => {
    const row = r as unknown as LoopRow
    const c = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts
    const ageDays = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86400000)
    return {
      id: row.id,
      fromContactId: row.from_contact_id,
      fromFirstName: c?.first_name ?? '',
      fromLastName: c?.last_name ?? null,
      context: row.context,
      ageDays,
    }
  })

  const pRow = principleRes.data as { principle: string; month: string; target_applications: number; reflection: string | null } | null
  const principleOfMonth: PrincipleOfMonthSnapshot | null = pRow ? {
    principle: pRow.principle,
    month: pRow.month,
    targetApplications: pRow.target_applications,
    reflection: pRow.reflection,
  } : null

  return { birthdaysToday, specialDatesToday, loopsToClose, principleOfMonth }
}
