import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import Anthropic from '@anthropic-ai/sdk'
import { EventParseSchema, ParsedEventSchema } from './_schemas/event.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = EventParseSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const supabase = getSupabase()
  const { data: userData } = await supabase
    .from('users')
    .select('anthropic_api_key')
    .eq('id', user.id)
    .single()

  const apiKey = userData?.anthropic_api_key ?? process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return res.status(400).json({ error: 'ANTHROPIC_API_KEY não configurada' })

  const { text } = parsed.data
  const now = new Date()
  const tz = 'America/Sao_Paulo'

  const prompt = `Parse a calendar event from natural language. Return ONLY valid JSON, no markdown.

Current date/time: ${now.toISOString()}
Timezone: ${tz}
User input: "${text}"

JSON fields:
- summary: string (event title, required)
- startAt: ISO 8601 datetime (required, infer from context)
- endAt: ISO 8601 datetime (required, default 30min after start)
- allDay: boolean (default false)
- location: string or null
- calendarHint: string or null (calendar name if mentioned)
- confidence: "high" | "medium" | "low"
- notes: string or null

Rules:
- Use current year if not specified
- If time already passed today, assume tomorrow or next occurrence
- All-day: startAt=T00:00:00.000Z, endAt=T23:59:59.000Z
- Respond with ONLY the JSON object`

  try {
    const anthropic = new Anthropic({ apiKey })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = msg.content[0]
    if (block?.type !== 'text') throw new Error('sem resposta')

    const jsonMatch = block.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON não encontrado')

    const result = ParsedEventSchema.safeParse(JSON.parse(jsonMatch[0]))
    if (!result.success) throw new Error(result.error.issues[0]?.message)

    return res.status(200).json(result.data)
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Erro ao interpretar' })
  }
}
