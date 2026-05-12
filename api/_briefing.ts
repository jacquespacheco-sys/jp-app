import { getSupabase } from './_supabase.js'
import Anthropic from '@anthropic-ai/sdk'
import Parser from 'rss-parser'
import { Resend } from 'resend'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const rssParser = new Parser()

interface RssItem { title: string; summary: string; url: string }
interface NewsItem { source: string; title: string; summary: string; url: string }
interface AgendaItem { summary: string; start_at: string; all_day: boolean }
interface TaskItem { title: string; status: string }
interface AqalQuadrantSnapshot { quadrant: string; completed: number; minutes: number }
interface AqalAreaSnapshot { areaId: string; name: string; quadrant: string; open: number }
interface AqalProjectSnapshot { id: string; name: string; horizon: string; openTasks: number; pct: number }
interface ContextSnapshot {
  quadrants7d: AqalQuadrantSnapshot[]
  areasOpen: AqalAreaSnapshot[]
  topProjects: AqalProjectSnapshot[]
  totals: { openTasks: number; completedThisWeek: number }
}

const MODEL = 'claude-haiku-4-5-20251001'

async function fetchRssItems(url: string, max = 5): Promise<RssItem[]> {
  try {
    const feed = await rssParser.parseURL(url)
    return (feed.items ?? []).slice(0, max).map(item => ({
      title: item.title ?? '(sem título)',
      summary: item.contentSnippet ?? item.content ?? '',
      url: item.link ?? url,
    }))
  } catch (err) {
    console.error('[rss] fetch failed:', url, err instanceof Error ? err.message : err)
    return []
  }
}

async function fetchAqalContext(userId: string): Promise<ContextSnapshot> {
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
      if (acc) {
        acc.completed += 1
        acc.minutes += t.time_estimate_min ?? 0
      }
    }
  }
  const quadrants7d: AqalQuadrantSnapshot[] = QUADS.map(q => ({
    quadrant: q,
    ...byQuadMap.get(q)!,
  }))

  const areaOpenMap = new Map<string, number>()
  for (const t of tasks) {
    if (!t.area_id) continue
    if (t.status !== 'done' && t.status !== 'cancelled') {
      areaOpenMap.set(t.area_id, (areaOpenMap.get(t.area_id) ?? 0) + 1)
    }
  }
  const areasOpen: AqalAreaSnapshot[] = areas
    .map(a => ({
      areaId: a.id, name: a.name, quadrant: a.quadrant,
      open: areaOpenMap.get(a.id) ?? 0,
    }))
    .filter(a => a.open > 0)
    .sort((a, b) => b.open - a.open)

  type ProjRow = {
    id: string; name: string; horizon: string;
    task_count: number; task_open_count: number; status_aqal: string;
  }
  const topProjects: AqalProjectSnapshot[] = (projectsRaw as unknown as ProjRow[])
    .map(p => {
      const total = p.task_count
      const done = total - p.task_open_count
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      return {
        id: p.id, name: p.name, horizon: p.horizon,
        openTasks: p.task_open_count, pct,
      }
    })
    .filter(p => p.openTasks > 0)
    .slice(0, 5)

  return {
    quadrants7d,
    areasOpen,
    topProjects,
    totals: {
      openTasks: tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
      completedThisWeek: quadrants7d.reduce((s, q) => s + q.completed, 0),
    },
  }
}

function aqalContextLines(ctx: ContextSnapshot): string {
  const quadLine = ctx.quadrants7d
    .filter(q => q.completed > 0)
    .map(q => `${q.quadrant}: ${q.completed} (${q.minutes}min)`)
    .join(' · ')
  const areaLines = ctx.areasOpen
    .slice(0, 6)
    .map(a => `- ${a.name} [${a.quadrant}]: ${a.open} abertas`)
    .join('\n')
  const projectLines = ctx.topProjects
    .map(p => `- ${p.name} (${p.horizon}): ${p.openTasks} tasks abertas, ${p.pct}% done`)
    .join('\n')
  return [
    quadLine ? `Distribuição últimos 7 dias por quadrante AQAL: ${quadLine}` : '',
    areaLines ? `\nÁreas com tasks abertas:\n${areaLines}` : '',
    projectLines ? `\nProjetos ativos (top):\n${projectLines}` : '',
    `\nTotal abertas: ${ctx.totals.openTasks} · Concluídas 7d: ${ctx.totals.completedThisWeek}`,
  ].filter(Boolean).join('\n')
}

function buildEmailHtml(params: {
  highlight: string
  dateLabel: string
  global: NewsItem[]
  brasil: NewsItem[]
  newsletters: NewsItem[]
  agenda: AgendaItem[]
  tasks: TaskItem[]
  ctx?: ContextSnapshot
}): string {
  const { highlight, dateLabel, global, brasil, newsletters, agenda, tasks, ctx } = params

  function newsBlock(label: string, items: NewsItem[]) {
    if (!items.length) return ''
    return `
      <div style="margin-bottom:28px">
        <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:12px">${label}</div>
        ${items.map(i => `
          <div style="padding:12px 0;border-bottom:1px solid #1c1c1c">
            <div style="font-size:10px;color:#666;margin-bottom:4px">${i.source}</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">
              <a href="${i.url}" style="color:#f0f0f0;text-decoration:none">${i.title}</a>
            </div>
            ${i.summary ? `<div style="font-size:12px;color:#888;line-height:1.5">${i.summary}</div>` : ''}
          </div>`).join('')}
      </div>`
  }

  const QUAD_COLORS: Record<string, string> = {
    I: '#a78bfa', IT: '#34d399', WE: '#fb923c', ITS: '#60a5fa',
  }

  const aqalBlock = !ctx ? '' : (() => {
    const totalCompleted = ctx.quadrants7d.reduce((s, q) => s + q.completed, 0)
    if (totalCompleted === 0 && ctx.totals.openTasks === 0) return ''
    const quadrantBars = ctx.quadrants7d.map(q => {
      const flex = q.completed > 0 ? q.completed : 0.05
      const color = QUAD_COLORS[q.quadrant] ?? '#888'
      return `<div style="background:${color};flex:${flex};height:6px"></div>`
    }).join('')
    const quadLabels = ctx.quadrants7d.map(q => {
      const color = QUAD_COLORS[q.quadrant] ?? '#888'
      return `<span style="color:${color};font-family:monospace;font-size:9px;letter-spacing:1px">${q.quadrant} ${q.completed}</span>`
    }).join('  ')
    const projectsBlock = ctx.topProjects.length === 0 ? '' : `
      <div style="margin-top:14px">
        <div style="font-family:monospace;font-size:8px;letter-spacing:1.5px;color:#666;text-transform:uppercase;margin-bottom:6px">projetos ativos</div>
        ${ctx.topProjects.slice(0, 3).map(p => `
          <div style="padding:6px 0;font-size:11px;color:#bbb">
            <span style="color:#7dd3fc">●</span> ${p.name}
            <span style="color:#666;font-family:monospace;font-size:9px;margin-left:6px">${p.horizon} · ${p.openTasks} abertas · ${p.pct}%</span>
          </div>`).join('')}
      </div>`
    return `
      <div style="margin-bottom:28px;padding:16px;background:#0e0e0e;border:1px solid #1c1c1c">
        <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:10px">AQAL · últimos 7 dias</div>
        <div style="display:flex;gap:2px;border-radius:3px;overflow:hidden;margin-bottom:8px">${quadrantBars}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap">${quadLabels}</div>
        <div style="margin-top:10px;font-family:monospace;font-size:10px;color:#888">
          ${ctx.totals.completedThisWeek} concluídas · ${ctx.totals.openTasks} abertas
        </div>
        ${projectsBlock}
      </div>`
  })()

  const agendaBlock = agenda.length === 0 ? '' : `
    <div style="margin-bottom:28px">
      <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:12px">Agenda de hoje</div>
      ${agenda.map(ev => {
        const time = ev.all_day ? 'DIA' : format(parseISO(ev.start_at), 'HH:mm')
        return `
          <div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid #1c1c1c;align-items:baseline">
            <div style="font-family:monospace;font-size:10px;color:#7dd3fc;min-width:32px">${time}</div>
            <div style="font-size:13px">${ev.summary}</div>
          </div>`
      }).join('')}
    </div>`

  const tasksBlock = tasks.length === 0 ? '' : `
    <div style="margin-bottom:28px">
      <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:12px">Tasks prioritárias</div>
      ${tasks.map(t => `
        <div style="padding:8px 0;border-bottom:1px solid #1c1c1c;font-size:13px;color:#ccc">${t.title}</div>`).join('')}
    </div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="background:#0a0a0a;color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:40px 24px">

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:36px">
    <div style="font-family:monospace;font-size:13px;letter-spacing:4px;font-weight:700;color:#7dd3fc">STATE</div>
    <div style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#444;text-transform:uppercase">${dateLabel}</div>
  </div>

  <div style="background:#7dd3fc;padding:24px;margin-bottom:36px">
    <div style="font-family:monospace;font-size:8px;letter-spacing:2px;color:#082f49;text-transform:uppercase;margin-bottom:8px">Insight do dia</div>
    <div style="font-size:20px;font-weight:700;color:#082f49;line-height:1.35">${highlight}</div>
  </div>

  ${aqalBlock}
  ${agendaBlock}
  ${tasksBlock}
  ${newsBlock('Mundial', global)}
  ${newsBlock('Brasil', brasil)}
  ${newsBlock('Newsletters', newsletters)}

  <div style="margin-top:48px;padding-top:20px;border-top:1px solid #1a1a1a;font-family:monospace;font-size:9px;color:#333;letter-spacing:1px">
    STATE INNOVATION CENTER · JP App
  </div>
</div>
</body>
</html>`
}

export interface GeneratedBriefing {
  id: string
  userId: string
  date: string
  highlight: string
  content: {
    global: NewsItem[]
    brasil: NewsItem[]
    newsletters: NewsItem[]
    agenda: unknown[]
    tasks: unknown[]
  }
  emailSent: boolean
  emailSentAt?: string
  model: string
  tokenCount: number
  createdAt: string
}

export async function generateBriefing(
  userId: string,
  userEmail: string,
  today: string
): Promise<GeneratedBriefing> {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada')

  const supabase = getSupabase()

  const [{ data: sources }, { data: tasks }, { data: visibleCals }, { data: events }, ctx] = await Promise.all([
    supabase.from('sources').select('*').eq('user_id', userId).eq('active', true),
    supabase.from('tasks')
      .select('title,status,due_date')
      .eq('user_id', userId)
      .in('status', ['next', 'doing'])
      .eq('archived', false)
      .order('due_date', { ascending: true })
      .limit(10),
    supabase.from('calendars').select('id').eq('user_id', userId).eq('is_visible', true),
    supabase.from('calendar_events')
      .select('summary,start_at,end_at,all_day,calendar_id')
      .eq('user_id', userId)
      .gte('start_at', `${today}T00:00:00Z`)
      .lte('start_at', `${today}T23:59:59Z`)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true }),
    fetchAqalContext(userId),
  ])

  type EventRow = { summary: string; start_at: string; end_at: string; all_day: boolean; calendar_id: string }
  const visibleCalIds = new Set((visibleCals ?? []).map(c => (c as { id: string }).id))
  const allEvents = (events ?? []) as EventRow[]
  const filteredEvents = visibleCalIds.size === 0 ? allEvents : allEvents.filter(e => visibleCalIds.has(e.calendar_id))

  const rssResults = await Promise.all(
    (sources ?? []).map(s =>
      fetchRssItems(s.url).then(items => ({ source: s.name, items }))
    )
  )

  console.error('[briefing] sources:', sources?.length ?? 0, '| rss items:', rssResults.flatMap(r => r.items).length)

  const newsLines = rssResults
    .flatMap(r => r.items.map(i => `[${r.source}] ${i.title} | ${i.url}`))
    .join('\n')

  const tasksLines = (tasks ?? [])
    .map(t => `- ${t.title} (${t.status})`)
    .join('\n')

  const eventsLines = filteredEvents
    .map(e => `- ${e.all_day ? '(dia todo)' : new Date(e.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${e.summary}`)
    .join('\n')

  const aqalLines = aqalContextLines(ctx)

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Você é o assistente pessoal do Jorge, founder do STATE Innovation Center, Curitiba/BR.
Gere um briefing matinal CONCISO para hoje (${today}).

CONTEXTO AQAL DO USUÁRIO:
${aqalLines}

NOTÍCIAS DO DIA (formato: [Fonte] Título | URL):
${newsLines || '(sem notícias)'}

AGENDA DE HOJE:
${eventsLines || '(sem eventos)'}

TASKS PRIORITÁRIAS:
${tasksLines || '(sem tasks)'}

Responda APENAS com JSON exato (sem markdown, sem texto fora do JSON):
{
  "highlight": "frase que conecta o estado AQAL atual ao dia (max 140 chars). Se vê desequilíbrio entre quadrantes, suavemente convide a atenção. Se vê foco, celebre. Se vê tasks acumulando em uma área, mencione.",
  "global": [{"source":"nome da fonte","title":"título original","summary":"resumo max 80 chars","url":"url exata fornecida acima"}],
  "brasil": [{"source":"nome da fonte","title":"título original","summary":"resumo max 80 chars","url":"url exata fornecida acima"}],
  "newsletters": []
}

Regras:
- Use APENAS as notícias fornecidas acima com suas URLs exatas. Máximo 3 em global, 2 em brasil.
- Classifique por relevância geográfica (brasil = notícias do Brasil).
- O highlight deve refletir o contexto AQAL real do usuário, não ser genérico.`,
    }],
  })

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  let parsed: { highlight?: string; global?: NewsItem[]; brasil?: NewsItem[]; newsletters?: NewsItem[] } = {}
  try {
    const m = raw.match(/\{[\s\S]*\}/)
    parsed = m ? (JSON.parse(m[0]) as typeof parsed) : {}
  } catch { /* keep empty */ }

  const content = {
    global: (parsed.global ?? []).slice(0, 3),
    brasil: (parsed.brasil ?? []).slice(0, 3),
    newsletters: parsed.newsletters ?? [],
    agenda: filteredEvents,
    tasks: tasks ?? [],
  }

  const highlight = parsed.highlight ?? 'Bom dia, Jorge.'
  const tokenCount = message.usage.input_tokens + message.usage.output_tokens

  let emailSent = false
  let emailSentAt: string | undefined
  const resendKey = process.env['RESEND_API_KEY']
  const fromEmail = process.env['RESEND_FROM_EMAIL'] ?? 'briefing@state.is'
  if (resendKey) {
    try {
      const resend = new Resend(resendKey)
      const dateLabel = format(parseISO(today), "EEEE, d 'de' MMMM", { locale: ptBR })
      const html = buildEmailHtml({
        highlight,
        dateLabel,
        global: content.global as NewsItem[],
        brasil: content.brasil as NewsItem[],
        newsletters: content.newsletters as NewsItem[],
        agenda: filteredEvents as AgendaItem[],
        tasks: (tasks ?? []) as TaskItem[],
        ctx,
      })
      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: userEmail,
        subject: `Briefing STATE — ${dateLabel}`,
        html,
      })
      if (!emailError) {
        emailSent = true
        emailSentAt = new Date().toISOString()
      }
    } catch { /* non-fatal */ }
  }

  // Markdown summary for content_md (compact text version)
  const contentMd = buildContentMarkdown({
    highlight, ctx, agenda: filteredEvents, tasks: (tasks ?? []) as TaskItem[],
    global: content.global, brasil: content.brasil,
  })

  const { data: briefing, error: dbError } = await supabase
    .from('briefings')
    .insert({
      user_id: userId,
      date: today,
      highlight,
      content: content as unknown as import('../src/types/database.ts').Json,
      email_sent: emailSent,
      email_sent_at: emailSentAt ?? null,
      model: MODEL,
      token_count: tokenCount,
      // AQAL fields
      briefed_for: today,
      content_md: contentMd,
      context_snapshot: ctx as unknown as import('../src/types/database.ts').Json,
      model_used: MODEL,
      delivered_at: emailSentAt ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (dbError) throw new Error(dbError.message)

  return {
    id: briefing.id,
    userId: briefing.user_id,
    date: briefing.date,
    highlight: briefing.highlight,
    content: briefing.content as unknown as GeneratedBriefing['content'],
    emailSent: briefing.email_sent,
    emailSentAt: briefing.email_sent_at ?? undefined,
    model: briefing.model,
    tokenCount: briefing.token_count ?? tokenCount,
    createdAt: briefing.created_at,
  }
}

function buildContentMarkdown(p: {
  highlight: string; ctx: ContextSnapshot;
  agenda: { summary: string; start_at: string; all_day: boolean }[];
  tasks: TaskItem[];
  global: NewsItem[]; brasil: NewsItem[];
}): string {
  const parts: string[] = []
  parts.push(`# ${p.highlight}`)

  const quadStr = p.ctx.quadrants7d
    .filter(q => q.completed > 0)
    .map(q => `${q.quadrant}=${q.completed}`)
    .join(' ')
  if (quadStr) parts.push(`\n## AQAL 7d\n${quadStr} (${p.ctx.totals.completedThisWeek} concluídas, ${p.ctx.totals.openTasks} abertas)`)

  if (p.ctx.topProjects.length > 0) {
    parts.push(`\n## Projetos ativos`)
    for (const proj of p.ctx.topProjects.slice(0, 5)) {
      parts.push(`- ${proj.name} (${proj.horizon}) — ${proj.openTasks} tasks · ${proj.pct}%`)
    }
  }

  if (p.agenda.length > 0) {
    parts.push(`\n## Agenda`)
    for (const e of p.agenda) {
      const time = e.all_day ? 'dia todo' : new Date(e.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      parts.push(`- ${time} — ${e.summary}`)
    }
  }

  if (p.tasks.length > 0) {
    parts.push(`\n## Tasks prioritárias`)
    for (const t of p.tasks.slice(0, 5)) parts.push(`- ${t.title} (${t.status})`)
  }

  if (p.global.length > 0) {
    parts.push(`\n## Mundial`)
    for (const n of p.global) parts.push(`- [${n.source}] ${n.title}`)
  }
  if (p.brasil.length > 0) {
    parts.push(`\n## Brasil`)
    for (const n of p.brasil) parts.push(`- [${n.source}] ${n.title}`)
  }

  return parts.join('\n')
}
