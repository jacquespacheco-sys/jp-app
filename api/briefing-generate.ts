import './_env.ts'
import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import Anthropic from '@anthropic-ai/sdk'
import Parser from 'rss-parser'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const rssParser = new Parser()

async function fetchRssItems(url: string, max = 5): Promise<Array<{ title: string; summary: string; url: string }>> {
  try {
    const feed = await rssParser.parseURL(url)
    return (feed.items ?? []).slice(0, max).map(item => ({
      title: item.title ?? '(sem título)',
      summary: item.contentSnippet ?? item.content ?? '',
      url: item.link ?? url,
    }))
  } catch {
    return []
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada' })
  }

  const supabase = getSupabase()
  const today = new Date().toISOString().slice(0, 10)

  // Check if briefing for today already exists
  const { data: existing } = await supabase
    .from('briefings')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  if (existing) {
    return res.status(409).json({ error: 'Briefing de hoje já gerado' })
  }

  // Fetch active sources
  const [{ data: sources }, { data: tasks }, { data: events }] = await Promise.all([
    supabase.from('sources').select('*').eq('user_id', user.id).eq('active', true),
    supabase.from('tasks').select('title,status,due_date')
      .eq('user_id', user.id)
      .in('status', ['next', 'doing'])
      .eq('archived', false)
      .order('due_date', { ascending: true })
      .limit(10),
    supabase.from('calendar_events').select('summary,start_at,end_at,all_day')
      .eq('user_id', user.id)
      .gte('start_at', `${today}T00:00:00Z`)
      .lte('start_at', `${today}T23:59:59Z`)
      .neq('status', 'cancelled')
      .order('start_at', { ascending: true }),
  ])

  // Fetch RSS feeds in parallel
  const rssResults = await Promise.all(
    (sources ?? []).map(s => fetchRssItems(s.url).then(items => ({ source: s.name, items })))
  )

  const newsLines = rssResults
    .flatMap(r => r.items.map(i => `[${r.source}] ${i.title}`))
    .join('\n')

  const tasksLines = (tasks ?? []).map(t => `- ${t.title} (${t.status})`).join('\n')
  const eventsLines = (events ?? []).map(e => `- ${e.all_day ? '(dia todo)' : new Date(e.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${e.summary}`).join('\n')

  const anthropic = new Anthropic({ apiKey })

  const prompt = `Você é o assistente pessoal do Jorge, founder do STATE Innovation Center, Curitiba/BR.
Gere um briefing matinal CONCISO para hoje (${today}).

NOTÍCIAS DO DIA:
${newsLines || '(sem notícias)'}

AGENDA DE HOJE:
${eventsLines || '(sem eventos)'}

TASKS PRIORITÁRIAS:
${tasksLines || '(sem tasks)'}

Responda em JSON exato:
{
  "highlight": "frase motivacional ou insight do dia (max 120 chars)",
  "global": [{"source":"...", "title":"...", "summary":"...(max 80 chars)", "url":"..."}],
  "brasil": [{"source":"...", "title":"...", "summary":"...(max 80 chars)", "url":"..."}],
  "newsletters": []
}

Máximo 3 itens em global e 2 em brasil. Priorize o que é mais relevante para Jorge.`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  let parsed: { highlight?: string; global?: unknown[]; brasil?: unknown[]; newsletters?: unknown[] } = {}
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as typeof parsed) : {}
  } catch { /* keep empty */ }

  const content = {
    global: (parsed.global ?? []).slice(0, 3),
    brasil: (parsed.brasil ?? []).slice(0, 3),
    newsletters: parsed.newsletters ?? [],
    agenda: events ?? [],
    tasks: tasks ?? [],
  }

  const { data: briefing, error } = await supabase
    .from('briefings')
    .insert({
      user_id: user.id,
      date: today,
      highlight: parsed.highlight ?? 'Bom dia, Jorge.',
      content,
      model: 'claude-haiku-4-5-20251001',
      token_count: message.usage.input_tokens + message.usage.output_tokens,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    briefing: {
      id: briefing.id, userId: briefing.user_id,
      date: briefing.date, highlight: briefing.highlight,
      content: briefing.content, emailSent: briefing.email_sent,
      model: briefing.model, tokenCount: briefing.token_count,
      createdAt: briefing.created_at,
    },
  })
}
