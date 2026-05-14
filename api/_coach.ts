import './_env.js'
import { fromZonedTime } from 'date-fns-tz'
import { getSupabase } from './_supabase.js'
import { fetchAqalContext, type AqalContextSnapshot } from './_briefing-context.js'
import { getAnthropic } from './_anthropic.js'

export { getAnthropic } from './_anthropic.js'

export const COACH_MODEL = 'claude-sonnet-4-6'
export const COACH_EXTRACTION_MODEL = 'claude-haiku-4-5-20251001'
export const SESSION_GAP_MINUTES = 240 // 4h
export const SNAPSHOT_TOP_MEMORIES = 20
export const SNAPSHOT_TOP_TASKS = 10
export const HISTORY_DEFAULT_LIMIT = 50
export const CHAT_CONTEXT_MSGS = 20

export interface CoachMessage {
  id: string
  direction: 'user_to_coach' | 'coach_to_user'
  contentMd: string
  createdAt: string
}

export interface CoachSnapshot {
  profile: {
    name: string
    tone: string
    valuesMd: string[]
    boundaries?: string
    northStarMd?: string
    h3Goals: Array<{ title: string; horizon: 'H3'; targetDate?: string }>
    systemPromptOverride?: string
  }
  memories: Array<{
    id: string
    kind: 'fact' | 'pattern' | 'promise' | 'concern' | 'preference'
    content: string
    relevance: number
  }>
  aqal: AqalContextSnapshot
  tasksTop: Array<{
    title: string
    status: string
    quadrant?: string
    dueAt?: string
  }>
  todayEvents: Array<{ summary: string; startAt: string; allDay: boolean }>
  todayHabits: Array<{ title: string; dose: 'full' | 'min' | 'skip' | null }>
}

export interface BuildSnapshotOpts {
  userId: string
  userName: string
  userTimezone?: string  // defaults to 'America/Sao_Paulo'
}

export async function buildCoachSnapshot(opts: BuildSnapshotOpts): Promise<CoachSnapshot> {
  const supabase = getSupabase()
  const tz = opts.userTimezone ?? 'America/Sao_Paulo'
  // local YYYY-MM-DD via Intl (avoids extra deps; matches pattern used in checkin-cron plan)
  const todayDateStr = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const dayStartUtc = fromZonedTime(`${todayDateStr}T00:00:00`, tz).toISOString()
  const dayEndUtc = fromZonedTime(`${todayDateStr}T23:59:59`, tz).toISOString()
  const nowIso = new Date().toISOString()

  const [profileRes, memRes, aqal, tasksRes, eventsRes, habitsRes, logsRes] = await Promise.all([
    supabase.from('coach_profile').select('*').eq('user_id', opts.userId).maybeSingle(),
    supabase.from('coach_memory')
      .select('id,kind,content,relevance')
      .eq('user_id', opts.userId)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('relevance', { ascending: false })
      .order('last_referenced_at', { ascending: false, nullsFirst: false })
      .limit(SNAPSHOT_TOP_MEMORIES),
    fetchAqalContext(opts.userId),
    supabase.from('v_tasks_resolved')
      .select('title,status,resolved_quadrant,due_at,area_id')
      .eq('user_id', opts.userId)
      .not('status', 'in', '(done,cancelled)')
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(SNAPSHOT_TOP_TASKS),
    supabase.from('calendar_events')
      .select('summary,start_at,all_day')
      .eq('user_id', opts.userId)
      .gte('start_at', dayStartUtc)
      .lte('start_at', dayEndUtc)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true }),
    supabase.from('habits')
      .select('id,title')
      .eq('user_id', opts.userId)
      .eq('active', true)
      .is('archived_at', null),
    supabase.from('habit_logs')
      .select('habit_id,dose')
      .eq('user_id', opts.userId)
      .eq('done_on', todayDateStr),
  ])

  for (const [label, res] of [
    ['profile', profileRes], ['memories', memRes], ['tasks', tasksRes],
    ['events', eventsRes], ['habits', habitsRes], ['habit_logs', logsRes],
  ] as const) {
    if (res.error) console.error(`[coach.snapshot] ${label} error:`, res.error.message)
  }

  const profileRow = profileRes.data as Record<string, unknown> | null
  const profile: CoachSnapshot['profile'] = profileRow
    ? {
        name: (profileRow['name'] as string | null) ?? 'Coach',
        tone: (profileRow['tone'] as string | null) ?? 'firme-mas-gentil',
        valuesMd: (profileRow['values_md'] as string[] | null) ?? [],
        h3Goals: (profileRow['h3_goals'] as CoachSnapshot['profile']['h3Goals'] | null) ?? [],
        ...(profileRow['boundaries'] ? { boundaries: profileRow['boundaries'] as string } : {}),
        ...(profileRow['north_star_md'] ? { northStarMd: profileRow['north_star_md'] as string } : {}),
        ...(profileRow['system_prompt_override'] ? { systemPromptOverride: profileRow['system_prompt_override'] as string } : {}),
      }
    : { name: 'Coach', tone: 'firme-mas-gentil', valuesMd: [], h3Goals: [] }

  const memories: CoachSnapshot['memories'] = (memRes.data ?? []).map(r => ({
    id: r.id as string,
    kind: r.kind as CoachSnapshot['memories'][number]['kind'],
    content: r.content as string,
    relevance: r.relevance as number,
  }))

  type TaskRow = { title: string; status: string; resolved_quadrant: string | null; due_at: string | null; area_id: string | null }
  const tasksTop: CoachSnapshot['tasksTop'] = ((tasksRes.data ?? []) as TaskRow[]).map(t => ({
    title: t.title,
    status: t.status,
    ...(t.resolved_quadrant ? { quadrant: t.resolved_quadrant } : {}),
    ...(t.due_at ? { dueAt: t.due_at } : {}),
  }))

  const todayEvents: CoachSnapshot['todayEvents'] = (eventsRes.data ?? []).map(e => ({
    summary: e.summary as string,
    startAt: e.start_at as string,
    allDay: e.all_day as boolean,
  }))

  type HabitRow = { id: string; title: string }
  type LogRow = { habit_id: string; dose: 'full' | 'min' | 'skip' }
  const doseMap = new Map<string, 'full' | 'min' | 'skip'>(
    ((logsRes.data ?? []) as LogRow[]).map(l => [l.habit_id, l.dose])
  )
  const todayHabits: CoachSnapshot['todayHabits'] = ((habitsRes.data ?? []) as HabitRow[]).map(h => ({
    title: h.title,
    dose: doseMap.get(h.id) ?? null,
  }))

  return { profile, memories, aqal, tasksTop, todayEvents, todayHabits }
}

export function formatSnapshotForPrompt(s: CoachSnapshot, userName: string): string {
  const memLines = s.memories.length === 0 ? '(nenhuma memória)' : s.memories.map(m =>
    `[${m.kind}] ${m.content} — relevance ${m.relevance}`
  ).join('\n')

  const quadLine = s.aqal.quadrants7d
    .filter(q => q.completed > 0)
    .map(q => `${q.quadrant}=${q.completed} (${q.minutes}min)`)
    .join(' · ') || '(nenhuma task concluída em 7d)'

  const taskLines = s.tasksTop.length === 0 ? '(nenhuma task aberta)' : s.tasksTop.map(t => {
    const parts = [`- ${t.title}`, `[${t.status}]`]
    if (t.quadrant) parts.push(`q=${t.quadrant}`)
    if (t.dueAt) parts.push(`due=${t.dueAt.slice(0, 10)}`)
    return parts.join(' ')
  }).join('\n')

  const evLines = s.todayEvents.length === 0 ? '(sem eventos hoje)' : s.todayEvents.map(e => {
    const time = e.allDay ? 'dia todo' : e.startAt.slice(11, 16)
    return `- ${time} ${e.summary}`
  }).join('\n')

  const habLines = s.todayHabits.length === 0 ? '(sem hábitos ativos)' : s.todayHabits.map(h => {
    const status = h.dose === null ? 'pendente' : h.dose
    return `- ${h.title}: ${status}`
  }).join('\n')

  const areaLines = s.aqal.areasOpen.slice(0, 5).map(a =>
    `- ${a.name} [${a.quadrant}]: ${a.open} abertas`
  ).join('\n') || '(sem áreas com tasks abertas)'

  return [
    `VALORES E LIMITES:`,
    s.profile.valuesMd.length ? s.profile.valuesMd.map(v => `- ${v}`).join('\n') : '(nenhum)',
    s.profile.boundaries ? `\nLimites: ${s.profile.boundaries}` : '',
    s.profile.northStarMd ? `\nNORTE:\n${s.profile.northStarMd}` : '',
    s.profile.h3Goals.length ? `\nMETAS H3:\n${s.profile.h3Goals.map(g => `- ${g.title}${g.targetDate ? ` (${g.targetDate})` : ''}`).join('\n')}` : '',
    `\nMEMÓRIAS ATIVAS (top ${SNAPSHOT_TOP_MEMORIES} por relevance):`,
    memLines,
    `\nESTADO HOJE (${userName}):`,
    `AQAL 7d: ${quadLine}`,
    `Concluídas 7d: ${s.aqal.totals.completedThisWeek} · Abertas: ${s.aqal.totals.openTasks}`,
    `\nÁreas top:\n${areaLines}`,
    `\nTasks abertas top:\n${taskLines}`,
    `\nAgenda hoje:\n${evLines}`,
    `\nHábitos hoje:\n${habLines}`,
  ].filter(Boolean).join('\n')
}

export function buildSystemPrompt(s: CoachSnapshot, userName: string): string {
  if (s.profile.systemPromptOverride) {
    return s.profile.systemPromptOverride + '\n\n' + formatSnapshotForPrompt(s, userName)
  }
  const snapshotBlock = formatSnapshotForPrompt(s, userName)
  return `Você é ${s.profile.name}, sócio sênior de ${userName}.

VOZ:
- Firme-mas-gentil. Direta, sem rodeios, sem suavizar.
- Trata por "você" (não "tu").
- Nunca usa "amigão", "campeão", emoji, ponto de exclamação enfático.
- Letra minúscula no início de frases.
- Quando observa um padrão, nomeia. Quando vê foco, celebra com sobriedade.
- Não pede desculpas. Não devolve a pergunta a menos que faça diferença real.

${snapshotBlock}

REGRAS:
- Responda em PT-BR.
- Conecte o que ele diz a memórias/snapshot quando faz sentido.
- Se ele divagar, traga de volta pro norte.
- Você NÃO cria tasks/notas. Se ele deveria criar algo, diga: "ponha X como next em [área Y]".
- Se ele pergunta "o que faço", responda direto.`
}

export async function touchMemories(userId: string, memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) return
  const supabase = getSupabase()
  await supabase
    .from('coach_memory')
    .update({ last_referenced_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', memoryIds)
}

export type CoachMemoryKind = 'fact' | 'pattern' | 'promise' | 'concern' | 'preference'

export interface CoachMemoryRow {
  id: string
  user_id: string
  kind: CoachMemoryKind
  content: string
  source: string | null
  related_area_id: string | null
  related_project_id: string | null
  related_task_id: string | null
  relevance: number
  expires_at: string | null
  last_referenced_at: string | null
  created_at: string
}

export interface CoachMemoryDto {
  id: string
  userId: string
  kind: CoachMemoryKind
  content: string
  source?: string
  relatedAreaId?: string
  relatedProjectId?: string
  relatedTaskId?: string
  relevance: number
  expiresAt?: string
  lastReferencedAt?: string
  createdAt: string
}

// Generates the coach paragraph for the morning briefing. Returns null on
// failure — briefing must keep working without it.
export async function generateCoachParagraph(userId: string, userName: string): Promise<string | null> {
  try {
    const supabase = getSupabase()
    const [snapshot, lastCheckInRes] = await Promise.all([
      buildCoachSnapshot({ userId, userName }),
      supabase
        .from('coach_log')
        .select('content_md')
        .eq('user_id', userId)
        .eq('kind', 'check_in')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    const snapshotText = formatSnapshotForPrompt(snapshot, userName)
    const lastCheckInText = (lastCheckInRes.data as { content_md: string } | null)?.content_md ?? '(nenhum)'

    const msg = await getAnthropic().messages.create({
      model: COACH_MODEL,
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Você é o sócio sênior de ${userName}.

${snapshotText}

Último check-in recente (NÃO repita o conteúdo):
${lastCheckInText}

Escreva o parágrafo de abertura do briefing matinal (120-180 palavras).
Voz: firme, direta, sem rodeios, sem emoji. Letra minúscula no início.
Estrutura:
- observação concreta sobre o quadro de 7 dias.
- uma cobrança OU celebração específica (cite áreas/projetos reais).
- foco do dia: UMA coisa, não lista.

Responda APENAS o texto do parágrafo, sem aspas, sem cabeçalhos.`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    return text || null
  } catch (e) {
    console.error('[coach.paragraph] failed:', e instanceof Error ? e.message : e)
    return null
  }
}

export function mapCoachMemoryRow(r: Partial<CoachMemoryRow>): CoachMemoryDto {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    kind: r.kind as CoachMemoryKind,
    content: r.content as string,
    relevance: r.relevance as number,
    createdAt: r.created_at as string,
    ...(r.source != null ? { source: r.source } : {}),
    ...(r.related_area_id != null ? { relatedAreaId: r.related_area_id } : {}),
    ...(r.related_project_id != null ? { relatedProjectId: r.related_project_id } : {}),
    ...(r.related_task_id != null ? { relatedTaskId: r.related_task_id } : {}),
    ...(r.expires_at != null ? { expiresAt: r.expires_at } : {}),
    ...(r.last_referenced_at != null ? { lastReferencedAt: r.last_referenced_at } : {}),
  }
}
