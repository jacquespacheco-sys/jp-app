import { getSupabase } from './_supabase.js'
import { generateCoachMessage } from './_hill-coach.js'
import type { HillCoachVoice } from '../src/types/database.js'

const DAY = 86_400_000

export const NUDGE_CATEGORIES = [
  { slug: 'procrastination', label: 'Procrastinação em tasks ligadas ao aim' },
  { slug: 'affirmation_skip', label: 'Afirmações com baixa adesão' },
  { slug: 'goal_risk', label: 'Goals com risco de prazo' },
  { slug: 'streak_broken', label: 'Streaks quebradas' },
  { slug: 'goal_near', label: 'Goals quase concluídos' },
  { slug: 'inactivity', label: 'Inatividade no app' },
  { slug: 'gratitude_skip', label: 'Padrão de gratidão' },
  { slug: 'milestone', label: 'Marcos de tempo' },
] as const

export type NudgeCategory = typeof NUDGE_CATEGORIES[number]['slug']

interface TriggerResult {
  category: NudgeCategory
  priority: number
  cooldownDays: number
  description: string
}

function dayStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function streakEndingAt(set: Set<string>, tz: string, start: Date): number {
  let cursor = start
  let n = 0
  while (set.has(dayStr(cursor, tz))) { n++; cursor = new Date(cursor.getTime() - DAY) }
  return n
}

/** Avalia os 8 gatilhos. Retorna os que dispararam (sem ordenar). */
export async function evaluateTriggers(userId: string, tz: string, aimCreatedAt: string): Promise<TriggerResult[]> {
  const supabase = getSupabase()
  const now = Date.now()
  const since30 = new Date(now - 30 * DAY).toISOString()

  const [affRes, goalsRes, logsRes, tasksRes] = await Promise.all([
    supabase.from('hill_affirmations').select('id,dimension').eq('user_id', userId).eq('status', 'active'),
    supabase.from('hill_goals').select('id,level,title,progress_pct,deadline,status,chief_aim_id,linked_project_id').eq('user_id', userId).eq('status', 'active'),
    supabase.from('hill_ritual_logs').select('type,started_at,completed_at,affirmations_skipped,gratitude_items').eq('user_id', userId).gte('started_at', since30),
    supabase.from('tasks').select('id,title,project_id,status,due_at,due_date,created_at').eq('user_id', userId).in('status', ['inbox', 'next']),
  ])

  const affs = affRes.data ?? []
  const goals = goalsRes.data ?? []
  const logs = logsRes.data ?? []
  const tasks = tasksRes.data ?? []
  const out: TriggerResult[] = []

  // G1 — procrastinação em task ligada ao aim
  const aimProjectIds = new Set(goals.filter(g => g.chief_aim_id && g.linked_project_id).map(g => g.linked_project_id))
  const overdue = tasks
    .map(t => {
      const dueRaw = t.due_at ?? (t.due_date ? `${t.due_date}T00:00:00.000Z` : null)
      return { t, due: dueRaw ? new Date(dueRaw).getTime() : null }
    })
    .filter(x => x.t.project_id && aimProjectIds.has(x.t.project_id) && x.due != null && x.due < now - 3 * DAY && new Date(x.t.created_at).getTime() < now - 4 * DAY)
    .sort((a, b) => (a.due ?? 0) - (b.due ?? 0))
  const worst = overdue[0]
  if (worst) {
    const days = Math.floor((now - (worst.due ?? now)) / DAY)
    out.push({ category: 'procrastination', priority: 95, cooldownDays: 4, description: `Task "${worst.t.title}" adiada há ${days} dias, ligada ao Chief Aim.` })
  }

  // G2 — afirmação com skip > 30% em 14 dias
  const logs14 = logs.filter(l => new Date(l.started_at).getTime() >= now - 14 * DAY)
  if (logs14.length >= 5 && affs.length) {
    let worstAff: { dimension: string; skips: number } | null = null
    for (const a of affs) {
      const skips = logs14.filter(l => (l.affirmations_skipped ?? []).includes(a.id)).length
      const rate = skips / logs14.length
      if (rate > 0.3 && (!worstAff || skips > worstAff.skips)) worstAff = { dimension: a.dimension, skips }
    }
    if (worstAff) {
      out.push({ category: 'affirmation_skip', priority: 70, cooldownDays: 14, description: `Afirmação de ${worstAff.dimension} pulada ${worstAff.skips} vezes nas últimas 2 semanas.` })
    }
  }

  // G3 — goal quarterly em risco de prazo
  const atRisk = goals
    .filter(g => g.level === 'quarterly' && g.deadline && new Date(`${g.deadline}T00:00:00Z`).getTime() <= now + 21 * DAY && g.progress_pct < 50)
    .sort((a, b) => new Date(`${a.deadline}T00:00:00Z`).getTime() - new Date(`${b.deadline}T00:00:00Z`).getTime())[0]
  if (atRisk) {
    const days = Math.ceil((new Date(`${atRisk.deadline}T00:00:00Z`).getTime() - now) / DAY)
    out.push({ category: 'goal_risk', priority: 85, cooldownDays: 10, description: `Goal "${atRisk.title}" em ${Math.round(atRisk.progress_pct)}% com ${days} dias até o prazo.` })
  }

  // G4 — streak quebrada após hábito formado (>=7)
  const todayStr = dayStr(new Date(now), tz)
  const yesterday = new Date(now - DAY)
  const yStr = dayStr(yesterday, tz)
  for (const type of ['morning', 'night'] as const) {
    const set = new Set(logs.filter(l => l.type === type && l.completed_at).map(l => dayStr(new Date(l.completed_at as string), tz)))
    if (!set.has(todayStr) && set.has(yStr)) {
      const streak = streakEndingAt(set, tz, yesterday)
      if (streak >= 7) {
        out.push({ category: 'streak_broken', priority: 60, cooldownDays: 3, description: `Streak de ${streak} dias (${type === 'morning' ? 'manhã' : 'noite'}) quebrou ontem.` })
        break
      }
    }
  }

  // G5 — goal quase batido
  const near = goals.find(g => g.progress_pct >= 85 && g.deadline && new Date(`${g.deadline}T00:00:00Z`).getTime() > now)
  if (near) {
    out.push({ category: 'goal_near', priority: 75, cooldownDays: 90, description: `Goal "${near.title}" em ${Math.round(near.progress_pct)}% — falta a última milha.` })
  }

  // G6 — inatividade (3 a 7 dias sem ritual)
  if (logs.length) {
    const lastStart = Math.max(...logs.map(l => new Date(l.started_at).getTime()))
    const daysSince = Math.floor((now - lastStart) / DAY)
    if (daysSince >= 3 && daysSince <= 7) {
      out.push({ category: 'inactivity', priority: 50, cooldownDays: 5, description: `${daysSince} dias sem ritual.` })
    }
  }

  // G7 — padrão de skip da gratidão (noturno)
  const nights = logs.filter(l => l.type === 'night' && l.completed_at).sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).slice(0, 10)
  if (nights.length >= 4) {
    const empty = nights.filter(l => !l.gratitude_items || l.gratitude_items.length === 0).length
    if (empty / nights.length > 0.5) {
      out.push({ category: 'gratitude_skip', priority: 40, cooldownDays: 21, description: 'Rituais noturnos completos mas pulando a gratidão na maioria das vezes.' })
    }
  }

  // G8 — marco de 30 dias do Chief Aim (janela tolerante a falhas de cron)
  const aimAge = Math.floor((now - new Date(aimCreatedAt).getTime()) / DAY)
  if (aimAge >= 30 && aimAge <= 33) {
    out.push({ category: 'milestone', priority: 30, cooldownDays: 30, description: 'Um mês desde que escreveu o Chief Aim.' })
  }

  return out
}

/** Pipeline por usuário (usado pelo cron). Retorna a categoria enviada ou null. */
export async function processUserNudge(userId: string, tz: string, aimCreatedAt: string): Promise<NudgeCategory | null> {
  const supabase = getSupabase()
  const now = Date.now()

  const { data: prefs } = await supabase.from('hill_preferences')
    .select('daily_nudge_enabled, disabled_categories, coach_voice').eq('user_id', userId).maybeSingle()
  if (prefs && prefs.daily_nudge_enabled === false) return null
  const disabled = new Set(prefs?.disabled_categories ?? [])
  const voice = (prefs?.coach_voice ?? 'mixed') as HillCoachVoice

  // P1 — no máx 1 por dia
  const { data: recent } = await supabase.from('hill_coach_messages')
    .select('nudge_category, user_feedback, created_at')
    .eq('user_id', userId).eq('mode', 'daily_nudge')
    .gte('created_at', new Date(now - 30 * DAY).toISOString())
    .order('created_at', { ascending: false })
  const recentNudges = recent ?? []
  const todayStr = dayStr(new Date(now), tz)
  if (recentNudges.some(n => dayStr(new Date(n.created_at), tz) === todayStr)) return null

  // Caso de borda: aim com < 7 dias → só inactivity/milestone
  const aimAge = Math.floor((now - new Date(aimCreatedAt).getTime()) / DAY)
  const earlyAllowed = new Set<NudgeCategory>(['inactivity', 'milestone'])

  // Auto-pausa: categoria com >=3 feedbacks negativos em 30 dias
  const negCount = new Map<string, number>()
  for (const n of recentNudges) {
    if (n.user_feedback === -1 && n.nudge_category) negCount.set(n.nudge_category, (negCount.get(n.nudge_category) ?? 0) + 1)
  }

  const fired = await evaluateTriggers(userId, tz, aimCreatedAt)
  const eligible = fired.filter(t => {
    if (disabled.has(t.category)) return false
    if (aimAge < 7 && !earlyAllowed.has(t.category)) return false
    if ((negCount.get(t.category) ?? 0) >= 3) return false
    const inCooldown = recentNudges.some(n =>
      n.nudge_category === t.category && new Date(n.created_at).getTime() > now - t.cooldownDays * DAY)
    return !inCooldown
  })
  if (eligible.length === 0) return null

  // P1 tie-break: prioridade desc, depois categoria (determinístico)
  eligible.sort((a, b) => b.priority - a.priority || a.category.localeCompare(b.category))
  const selected = eligible[0]!

  // P6 — falha silenciosa: se o LLM não gerar, nenhum nudge
  try {
    await generateCoachMessage({
      userId, userTimezone: tz, mode: 'daily_nudge', voice,
      trigger: selected.description, nudgeCategory: selected.category,
    })
  } catch {
    return null
  }
  return selected.category
}
