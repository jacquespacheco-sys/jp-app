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

  // Insert user msg first so it appears in history shown to the model.
  const { data: userMsgRow, error: insertErr } = await supabase.from('coach_log').insert({
    user_id: user.id,
    kind: 'chat',
    direction: 'user_to_coach',
    content_md: content,
  }).select('id').single()
  if (insertErr || !userMsgRow) {
    return res.status(500).json({ error: insertErr?.message ?? 'erro' })
  }
  const userMsgId = userMsgRow.id

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

  type LogRow = { id: string; direction: 'user_to_coach' | 'coach_to_user'; content_md: string; created_at: string }

  const historyRaw = ((historyRes.data ?? []) as LogRow[])
    .filter(m => m.id !== userMsgId)
    .slice(0, CHAT_CONTEXT_MSGS)
    .reverse()

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

  // Anthropic requires: first message is 'user' AND no consecutive same-role messages.
  // Drop leading assistant messages (can happen at session boundary).
  while (messages.length > 0 && messages[0]?.role === 'assistant') messages.shift()
  // Collapse consecutive same-role runs by keeping only the most recent in each run
  // (can happen if a previous coach response failed mid-stream).
  const deduped: typeof messages = []
  for (const m of messages) {
    const last = deduped[deduped.length - 1]
    if (last && last.role === m.role) {
      deduped[deduped.length - 1] = m
    } else {
      deduped.push(m)
    }
  }
  messages.length = 0
  messages.push(...deduped)

  const systemPrompt = buildSystemPrompt(snapshot, user.name)
  const memoryIds = snapshot.memories.map(m => m.id)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const send = (type: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
  }

  let assembled = ''
  let inputTokens = 0
  let outputTokens = 0
  let aborted = false

  const anthropic = getAnthropic()
  const stream = anthropic.messages.stream({
    model: COACH_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })

  // If client disconnects mid-stream, abort the Anthropic call and persist
  // whatever was assembled so far instead of throwing away the partial.
  const onClose = () => {
    aborted = true
    try { stream.controller.abort() } catch { /* noop */ }
  }
  req.on('close', onClose)

  try {
    for await (const event of stream) {
      if (event.type === 'message_start') {
        send('start', { userMsgId })
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        assembled += event.delta.text
        send('delta', { text: event.delta.text })
      }
    }

    const final = await stream.finalMessage()
    inputTokens = final.usage.input_tokens
    outputTokens = final.usage.output_tokens

    const { data: coachRow } = await supabase.from('coach_log').insert({
      user_id: user.id,
      kind: 'chat',
      direction: 'coach_to_user',
      content_md: assembled,
      context_snapshot: { memoryIds, tasksCount: snapshot.tasksTop.length, eventsCount: snapshot.todayEvents.length },
      model_used: COACH_MODEL,
      tokens_in: inputTokens,
      tokens_out: outputTokens,
    }).select('id,created_at').single()

    void touchMemories(user.id, memoryIds)

    send('done', {
      userMsgId,
      coachMsgId: coachRow?.id ?? null,
      coachCreatedAt: coachRow?.created_at ?? null,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
    })
    res.end()
  } catch (err) {
    console.error('[coach-chat] error:', err instanceof Error ? err.message : err)
    // Persist partial if any text was streamed before the abort/error.
    if (assembled.length > 0) {
      await supabase.from('coach_log').insert({
        user_id: user.id,
        kind: 'chat',
        direction: 'coach_to_user',
        content_md: assembled,
        context_snapshot: { memoryIds, partial: true },
        model_used: COACH_MODEL,
      }).then(null, () => {})
    }
    if (!aborted) {
      send('error', { message: 'erro no coach' })
      res.end()
    }
  } finally {
    req.off('close', onClose)
  }
}
