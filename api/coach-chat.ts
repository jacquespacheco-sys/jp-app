import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachChatSchema } from './_schemas/coach.js'
import {
  buildCoachSnapshot,
  buildSystemPrompt,
  getAnthropic,
  touchMemories,
  COACH_MODEL,
  CHAT_CONTEXT_MSGS,
  SESSION_GAP_MINUTES,
} from './_coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 60

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachChatSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const { content } = parsed.data

  const supabase = getSupabase()

  // Step 3: Insert user message BEFORE building snapshot (so it appears in history)
  const nowIso = new Date().toISOString()
  const { error: insertErr } = await supabase.from('coach_log').insert({
    user_id: user.id,
    kind: 'chat',
    direction: 'user_to_coach',
    content_md: content,
  })
  if (insertErr) {
    return res.status(500).json({ error: insertErr.message })
  }

  // Step 4: Load snapshot + history concurrently
  const [snapshot, historyRes] = await Promise.all([
    buildCoachSnapshot({
      userId: user.id,
      userName: user.name,
      ...(user.timezone ? { userTimezone: user.timezone } : {}),
    }),
    supabase
      .from('coach_log')
      .select('id,direction,content_md,created_at')
      .eq('user_id', user.id)
      .eq('kind', 'chat')
      .order('created_at', { ascending: false })
      .limit(CHAT_CONTEXT_MSGS + 1),
  ])

  // Step 5: Build messages array
  type LogRow = { id: string; direction: 'user_to_coach' | 'coach_to_user'; content_md: string; created_at: string }

  const historyRaw = ((historyRes.data ?? []) as LogRow[])
    .filter(m => !(
      m.direction === 'user_to_coach' &&
      m.content_md === content &&
      Math.abs(new Date(m.created_at).getTime() - new Date(nowIso).getTime()) < 2000
    ))
    .slice(0, CHAT_CONTEXT_MSGS)
    .reverse() // ascending order

  const sessionMsgs: LogRow[] = []
  for (let i = historyRaw.length - 1; i >= 0; i--) {
    const msg = historyRaw[i]!
    if (sessionMsgs.length === 0) { sessionMsgs.unshift(msg); continue }
    const prev = sessionMsgs[0]!
    const gapMin = (new Date(prev.created_at).getTime() - new Date(msg.created_at).getTime()) / 60000
    if (gapMin > SESSION_GAP_MINUTES) break
    sessionMsgs.unshift(msg)
  }

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = sessionMsgs.map(m => ({
    role: m.direction === 'user_to_coach' ? 'user' as const : 'assistant' as const,
    content: m.content_md,
  }))

  // Ensure the inserted user msg is the last element
  if (messages[messages.length - 1]?.content !== content || messages[messages.length - 1]?.role !== 'user') {
    messages.push({ role: 'user', content })
  }

  // Step 6: System prompt + memory ids
  const systemPrompt = buildSystemPrompt(snapshot, user.name)
  const memoryIds = snapshot.memories.map(m => m.id)

  // Step 7: Open SSE response
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  // Step 8: SSE helper
  const send = (type: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
  }

  // Steps 9-12: Stream from Anthropic, insert response, touch memories, send done
  let assembled = ''
  let inputTokens = 0
  let outputTokens = 0

  try {
    const anthropic = getAnthropic()
    const stream = anthropic.messages.stream({
      model: COACH_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    })

    for await (const event of stream) {
      if (event.type === 'message_start') {
        send('start', {})
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        assembled += event.delta.text
        send('delta', { text: event.delta.text })
      }
    }

    const final = await stream.finalMessage()
    inputTokens = final.usage.input_tokens
    outputTokens = final.usage.output_tokens

    // Step 10: Insert coach response
    await supabase.from('coach_log').insert({
      user_id: user.id,
      kind: 'chat',
      direction: 'coach_to_user',
      content_md: assembled,
      context_snapshot: { memoryIds, tasksCount: snapshot.tasksTop.length, eventsCount: snapshot.todayEvents.length },
      model_used: COACH_MODEL,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
    })

    // Step 11: Fire-and-forget touch memories
    void touchMemories(user.id, memoryIds)

    // Step 12: Done event
    send('done', { tokensIn: inputTokens, tokensOut: outputTokens })
    res.end()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[coach-chat] error:', msg)
    send('error', { message: msg })
    res.end()
  }
}
