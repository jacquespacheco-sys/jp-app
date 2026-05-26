import { randomUUID } from 'node:crypto'
import { getAnthropic, htmlEscape } from './_anthropic.js'
import { getSupabase } from './_supabase.js'
import { COACH_HILL_SYSTEM_PROMPT } from './_hill-coach-prompt.js'
import type { HillCoachMode, HillCoachVoice } from '../src/types/database.js'

export { COACH_HILL_SYSTEM_PROMPT }

export const HILL_MODELS: Record<HillCoachMode, string> = {
  chat: 'claude-sonnet-4-6',
  wizard_step: 'claude-sonnet-4-6',
  ritual_murmur: 'claude-haiku-4-5-20251001',
  daily_nudge: 'claude-haiku-4-5-20251001',
}

export const HILL_MAX_TOKENS: Record<HillCoachMode, number> = {
  chat: 1024, wizard_step: 600, ritual_murmur: 80, daily_nudge: 200,
}

// Preço aproximado (USD/token) só para logar custo
const PRICE: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3 / 1e6, out: 15 / 1e6 },
  'claude-haiku-4-5-20251001': { in: 1 / 1e6, out: 5 / 1e6 },
}

export function calcCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICE[model] ?? { in: 0, out: 0 }
  return Number((tokensIn * p.in + tokensOut * p.out).toFixed(6))
}

const VOICE_DIRECTIVE: Record<HillCoachVoice, string> = {
  strict: '\n\n## AJUSTE DE VOZ\nMais exigente e direto. Menos amaciado. Não suavize a verdade.',
  mixed: '',
  gentle: '\n\n## AJUSTE DE VOZ\nMais acolhedor. Ainda firme e honesto, mas com mais calor e paciência.',
}

export function systemPromptFor(voice: HillCoachVoice): string {
  return COACH_HILL_SYSTEM_PROMPT + VOICE_DIRECTIVE[voice]
}

export function parseActionTag(text: string): { content: string; action?: { type: string; payload: unknown } } {
  const m = text.match(/<action\s+type="([^"]+)"\s+payload='([^']*)'\s*\/>/)
  if (!m) return { content: text.trim() }
  let payload: unknown = m[2]
  try { payload = JSON.parse(m[2] ?? 'null') } catch { /* mantém string crua */ }
  return { content: text.replace(m[0], '').trim(), action: { type: m[1] as string, payload } }
}

function sinceISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function dayStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function streakFrom(days: Set<string>, tz: string): number {
  let cursor = new Date()
  if (!days.has(dayStr(cursor, tz))) {
    cursor = new Date(cursor.getTime() - 86_400_000)
    if (!days.has(dayStr(cursor, tz))) return 0
  }
  let n = 0
  while (days.has(dayStr(cursor, tz))) { n++; cursor = new Date(cursor.getTime() - 86_400_000) }
  return n
}

/** Monta o bloco <user_context> em XML (formato do system prompt). */
export async function buildUserContext(userId: string, tz: string): Promise<string> {
  const supabase = getSupabase()
  const [aimRes, affRes, goalsRes, ritualRes, tasksRes] = await Promise.all([
    supabase.from('hill_chief_aims').select('aim_text,deadline').eq('user_id', userId).eq('is_active', true).maybeSingle(),
    supabase.from('hill_affirmations').select('dimension,text,belief_score').eq('user_id', userId).eq('status', 'active').order('dimension'),
    supabase.from('hill_goals').select('level,title,progress_pct').eq('user_id', userId).eq('status', 'active').limit(8),
    supabase.from('hill_ritual_logs').select('type,completed_at').eq('user_id', userId).not('completed_at', 'is', null).gte('completed_at', sinceISO(30)),
    supabase.from('tasks').select('title,status,due_at,updated_at').eq('user_id', userId).in('status', ['inbox', 'next', 'waiting', 'doing']).order('updated_at', { ascending: true }).limit(5),
  ])

  const parts: string[] = []

  const aim = aimRes.data
  if (aim) {
    const remaining = Math.round((new Date(`${aim.deadline}T00:00:00`).getTime() - Date.now()) / 86_400_000)
    parts.push(`  <chief_aim>\n    <text>${htmlEscape(aim.aim_text)}</text>\n    <deadline>${aim.deadline}</deadline>\n    <days_remaining>${remaining}</days_remaining>\n  </chief_aim>`)
  }

  const affs = affRes.data ?? []
  if (affs.length) {
    const items = affs.map(a => `    <aff dim="${a.dimension}" belief="${a.belief_score}">${htmlEscape(a.text)}</aff>`).join('\n')
    parts.push(`  <affirmations>\n${items}\n  </affirmations>`)
  }

  const goals = goalsRes.data ?? []
  if (goals.length) {
    const items = goals.map(g => `    <goal type="${g.level}" progress="${Math.round(g.progress_pct)}">${htmlEscape(g.title)}</goal>`).join('\n')
    parts.push(`  <active_goals>\n${items}\n  </active_goals>`)
  }

  const logs = ritualRes.data ?? []
  const morning = new Set<string>(), night = new Set<string>()
  for (const l of logs) {
    if (!l.completed_at) continue
    ;(l.type === 'night' ? night : morning).add(dayStr(new Date(l.completed_at), tz))
  }
  parts.push(`  <ritual_stats days="30">\n    <morning adherence="${Math.round((morning.size / 30) * 100)}%" />\n    <night adherence="${Math.round((night.size / 30) * 100)}%" />\n    <streak_current days="${streakFrom(morning, tz)}" />\n  </ritual_stats>`)

  const tasks = tasksRes.data ?? []
  if (tasks.length) {
    const items = tasks.map(t => `    <task status="${t.status}">${htmlEscape(t.title)}</task>`).join('\n')
    parts.push(`  <recent_tasks>\n${items}\n  </recent_tasks>`)
  }

  return `\n${parts.join('\n')}\n`
}

interface BuildMsgOpts {
  message?: string
  contextXml?: string
  dimension?: string
  draft?: string
  trigger?: string
  murmurContext?: string
}

export function buildUserMessage(mode: HillCoachMode, o: BuildMsgOpts): string {
  switch (mode) {
    case 'chat':
      return `<mode>chat</mode>\n<user_context>${o.contextXml ?? ''}</user_context>\n\n${o.message ?? ''}`
    case 'wizard_step':
      return `<mode>wizard_step</mode>\n<dimension>${o.dimension ?? ''}</dimension>\n<draft>${o.draft ?? ''}</draft>\n<user_context>${o.contextXml ?? ''}</user_context>`
    case 'ritual_murmur':
      return `<mode>ritual_murmur</mode>\n<context>${o.murmurContext ?? ''}</context>`
    case 'daily_nudge':
      return `<mode>daily_nudge</mode>\n<trigger>${o.trigger ?? ''}</trigger>\n<user_context>${o.contextXml ?? ''}</user_context>`
  }
}

interface PersistInput {
  userId: string
  conversationId: string
  mode: HillCoachMode
  role: 'user' | 'coach'
  content: string
  contextUsed?: unknown
  tokensIn?: number
  tokensOut?: number
  model?: string
  cost?: number
  actionPayload?: unknown
}

export async function persistMessage(p: PersistInput): Promise<{ id: string; createdAt: string } | null> {
  const supabase = getSupabase()
  const { data } = await supabase.from('hill_coach_messages').insert({
    user_id: p.userId,
    conversation_id: p.conversationId,
    mode: p.mode,
    role: p.role,
    content: p.content,
    ...(p.contextUsed != null ? { context_used: p.contextUsed as never } : {}),
    ...(p.tokensIn != null ? { tokens_in: p.tokensIn } : {}),
    ...(p.tokensOut != null ? { tokens_out: p.tokensOut } : {}),
    ...(p.model != null ? { model: p.model } : {}),
    ...(p.cost != null ? { cost: p.cost } : {}),
    ...(p.actionPayload != null ? { action_payload: p.actionPayload as never } : {}),
  }).select('id,created_at').single()
  return data ? { id: data.id, createdAt: data.created_at } : null
}

export interface GenerateInput {
  userId: string
  userTimezone: string
  mode: 'ritual_murmur' | 'wizard_step' | 'daily_nudge'
  voice?: HillCoachVoice
  dimension?: string
  draft?: string
  trigger?: string
  murmurContext?: string
}

export interface GenerateOutput {
  content: string
  action?: { type: string; payload: unknown }
  conversationId: string
  cost: number
}

/** One-shot (não-streaming) para murmur/wizard_step/daily_nudge. */
export async function generateCoachMessage(input: GenerateInput): Promise<GenerateOutput> {
  const needsContext = input.mode !== 'ritual_murmur'
  const contextXml = needsContext ? await buildUserContext(input.userId, input.userTimezone) : undefined

  const userMessage = buildUserMessage(input.mode, {
    ...(contextXml !== undefined ? { contextXml } : {}),
    ...(input.dimension !== undefined ? { dimension: input.dimension } : {}),
    ...(input.draft !== undefined ? { draft: input.draft } : {}),
    ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
    ...(input.murmurContext !== undefined ? { murmurContext: input.murmurContext } : {}),
  })

  const model = HILL_MODELS[input.mode]
  const msg = await getAnthropic().messages.create({
    model,
    max_tokens: HILL_MAX_TOKENS[input.mode],
    system: systemPromptFor(input.voice ?? 'mixed'),
    messages: [{ role: 'user', content: userMessage }],
  })

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  const { content, action } = parseActionTag(raw)
  const cost = calcCost(model, msg.usage.input_tokens, msg.usage.output_tokens)
  const conversationId = randomUUID()

  await persistMessage({
    userId: input.userId,
    conversationId,
    mode: input.mode,
    role: 'coach',
    content,
    ...(contextXml != null ? { contextUsed: { xml: contextXml } } : {}),
    tokensIn: msg.usage.input_tokens,
    tokensOut: msg.usage.output_tokens,
    model,
    cost,
    ...(action != null ? { actionPayload: action } : {}),
  })

  return { content, action, conversationId, cost }
}
