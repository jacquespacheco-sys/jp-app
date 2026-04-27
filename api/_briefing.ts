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

function buildEmailHtml(params: {
  highlight: string
  dateLabel: string
  global: NewsItem[]
  brasil: NewsItem[]
  newsletters: NewsItem[]
  agenda: AgendaItem[]
  tasks: TaskItem[]
}): string {
  const { highlight, dateLabel, global, brasil, newsletters, agenda, tasks } = params

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

  const agendaBlock = agenda.length === 0 ? '' : `
    <div style="margin-bottom:28px">
      <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:12px">Agenda de hoje</div>
      ${agenda.map(ev => {
        const time = ev.all_day ? 'DIA' : format(parseISO(ev.start_at), 'HH:mm')
        return `
          <div style="display:flex;gap:14px;padding:10px 0;border-bottom:1px solid #1c1c1c;align-items:baseline">
            <div style="font-family:monospace;font-size:10px;color:#a8ff00;min-width:32px">${time}</div>
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
    <div style="font-family:monospace;font-size:13px;letter-spacing:4px;font-weight:700;color:#a8ff00">STATE</div>
    <div style="font-family:monospace;font-size:9px;letter-spacing:1px;color:#444;text-transform:uppercase">${dateLabel}</div>
  </div>

  <div style="background:#a8ff00;padding:24px;margin-bottom:36px">
    <div style="font-family:monospace;font-size:8px;letter-spacing:2px;color:#1a1a00;text-transform:uppercase;margin-bottom:8px">Insight do dia</div>
    <div style="font-size:20px;font-weight:700;color:#0a0a0a;line-height:1.35">${highlight}</div>
  </div>

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

  const [{ data: sources }, { data: tasks }, { data: events }] = await Promise.all([
    supabase.from('sources').select('*').eq('user_id', userId).eq('active', true),
    supabase.from('tasks')
      .select('title,status,due_date')
      .eq('user_id', userId)
      .in('status', ['next', 'doing'])
      .eq('archived', false)
      .order('due_date', { ascending: true })
      .limit(10),
    supabase.from('calendar_events')
      .select('summary,start_at,end_at,all_day')
      .eq('user_id', userId)
      .gte('start_at', `${today}T00:00:00Z`)
      .lte('start_at', `${today}T23:59:59Z`)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true }),
  ])

  const rssResults = await Promise.all(
    (sources ?? []).map(s =>
      fetchRssItems(s.url).then(items => ({ source: s.name, items }))
    )
  )

  console.log('[briefing] sources:', sources?.length ?? 0, '| rss items:', rssResults.flatMap(r => r.items).length)

  const newsLines = rssResults
    .flatMap(r => r.items.map(i => `[${r.source}] ${i.title} | ${i.url}`))
    .join('\n')

  const tasksLines = (tasks ?? [])
    .map(t => `- ${t.title} (${t.status})`)
    .join('\n')

  const eventsLines = (events ?? [])
    .map(e =>
      `- ${e.all_day ? '(dia todo)' : new Date(e.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${e.summary}`
    )
    .join('\n')

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Você é o assistente pessoal do Jorge, founder do STATE Innovation Center, Curitiba/BR.
Gere um briefing matinal CONCISO para hoje (${today}).

NOTÍCIAS DO DIA (formato: [Fonte] Título | URL):
${newsLines || '(sem notícias)'}

AGENDA DE HOJE:
${eventsLines || '(sem eventos)'}

TASKS PRIORITÁRIAS:
${tasksLines || '(sem tasks)'}

Responda APENAS com JSON exato (sem markdown, sem texto fora do JSON):
{
  "highlight": "frase motivacional ou insight do dia (max 120 chars)",
  "global": [{"source":"nome da fonte","title":"título original","summary":"resumo max 80 chars","url":"url exata fornecida acima"}],
  "brasil": [{"source":"nome da fonte","title":"título original","summary":"resumo max 80 chars","url":"url exata fornecida acima"}],
  "newsletters": []
}

Regras: use APENAS as notícias fornecidas acima com suas URLs exatas. Máximo 3 em global, 2 em brasil. Classifique por relevância geográfica (brasil = notícias do Brasil).`,
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
    agenda: events ?? [],
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
        agenda: (events ?? []) as AgendaItem[],
        tasks: (tasks ?? []) as TaskItem[],
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

  const { data: briefing, error: dbError } = await supabase
    .from('briefings')
    .insert({
      user_id: userId,
      date: today,
      highlight,
      content: content as unknown as import('../src/types/database.ts').Json,
      email_sent: emailSent,
      email_sent_at: emailSentAt ?? null,
      model: 'claude-haiku-4-5-20251001',
      token_count: tokenCount,
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
