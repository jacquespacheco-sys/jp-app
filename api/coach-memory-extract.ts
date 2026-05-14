import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachMemoryExtractSchema } from './_schemas/coach.js'
import { COACH_EXTRACTION_MODEL } from './_coach.js'
import { getAnthropic, parseJsonFromLlm } from './_anthropic.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 30

interface ExtractedItem {
  kind: 'fact' | 'pattern' | 'promise' | 'concern' | 'preference'
  content: string
  relevance: number
  expires_at: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachMemoryExtractSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const { sinceLogId } = parsed.data

  const supabase = getSupabase()

  let query = supabase.from('coach_log')
    .select('id,direction,content_md,created_at')
    .eq('user_id', user.id)
    .eq('kind', 'chat')
    .order('created_at', { ascending: false })
    .limit(20)

  if (sinceLogId) {
    const { data: sinceRow } = await supabase.from('coach_log')
      .select('created_at').eq('id', sinceLogId).eq('user_id', user.id).maybeSingle()
    const sinceTs = (sinceRow as { created_at: string } | null)?.created_at
    if (sinceTs) query = query.gt('created_at', sinceTs)
  }

  const { data: msgsRaw, error: msgErr } = await query
  if (msgErr) return res.status(500).json({ error: msgErr.message })

  type Row = { id: string; direction: string; content_md: string; created_at: string }
  const msgs = ((msgsRaw ?? []) as Row[]).reverse()
  if (msgs.length === 0) {
    return res.status(200).json({ candidates: [] })
  }
  const lastLogId = msgs[msgs.length - 1]!.id

  const dialog = msgs.map(m => {
    const speaker = m.direction === 'user_to_coach' ? 'jorge' : 'coach'
    return `${speaker}: ${m.content_md}`
  }).join('\n\n')

  const anthropic = getAnthropic()
  const message = await anthropic.messages.create({
    model: COACH_EXTRACTION_MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Você é um extrator de memórias. Olhando o diálogo abaixo entre Jorge e seu coach,
identifique até 3 itens que devem virar memória de longo prazo.
Ignore conteúdo trivial, saudações, ou repetições.

Cada item: {
  "kind": "fact" | "pattern" | "promise" | "concern" | "preference",
  "content": "frase curta em PT-BR, terceira pessoa ('Jorge ...')",
  "relevance": número de 0 a 100,
  "expires_at": ISO date ou null se permanente
}

Definições:
- fact: dado biográfico ou da vida atual
- pattern: padrão de comportamento observado
- promise: algo que Jorge prometeu fazer
- concern: preocupação ou medo recorrente
- preference: gosto/aversão recorrente

Responda APENAS com JSON: {"memories": [...]}.
Se nada relevante, {"memories": []}.

Diálogo:
${dialog}`,
    }],
  })

  const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}'
  const parsedJson = parseJsonFromLlm<{ memories?: ExtractedItem[] }>(raw)
  const extracted = (parsedJson?.memories ?? []).slice(0, 3)

  if (extracted.length === 0) {
    return res.status(200).json({ candidates: [] })
  }

  const rows = extracted.map(e => ({
    user_id: user.id,
    source_log_id: lastLogId,
    kind: e.kind,
    content: e.content,
    relevance: typeof e.relevance === 'number' ? Math.max(0, Math.min(100, Math.round(e.relevance))) : 50,
    expires_at: e.expires_at && /^\d{4}-\d{2}-\d{2}/.test(e.expires_at) ? e.expires_at : null,
    status: 'pending' as const,
  }))

  const { data: inserted, error: insErr } = await supabase
    .from('coach_memory_candidate').insert(rows).select()
  if (insErr) return res.status(500).json({ error: insErr.message })

  return res.status(200).json({
    candidates: (inserted ?? []).map(c => ({
      id: c.id, kind: c.kind, content: c.content, relevance: c.relevance,
      expiresAt: c.expires_at, sourceLogId: c.source_log_id, createdAt: c.created_at,
    })),
  })
}
