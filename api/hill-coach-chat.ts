import { randomUUID } from 'node:crypto'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAnthropic } from './_anthropic.js'
import { CoachChatSchema } from './_schemas/hill.js'
import {
  buildUserContext, buildUserMessage, systemPromptFor,
  parseActionTag, calcCost, HILL_MODELS, HILL_MAX_TOKENS,
} from './_hill-coach.js'
import type { HillCoachVoice } from '../src/types/database.js'
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
  const { message } = parsed.data
  const conversationId = parsed.data.conversationId ?? randomUUID()
  const supabase = getSupabase()

  // Persiste a mensagem do usuário (conteúdo cru) antes de chamar o modelo
  const { data: userRow, error: insErr } = await supabase.from('hill_coach_messages').insert({
    user_id: user.id, conversation_id: conversationId, mode: 'chat', role: 'user', content: message,
  }).select('id').single()
  if (insErr || !userRow) return res.status(500).json({ error: insErr?.message ?? 'erro' })

  const [prefsRes, contextXml, historyRes] = await Promise.all([
    supabase.from('hill_preferences').select('coach_voice').eq('user_id', user.id).maybeSingle(),
    buildUserContext(user.id, user.timezone),
    supabase.from('hill_coach_messages').select('id,role,content,created_at')
      .eq('user_id', user.id).eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }).limit(40),
  ])

  const voice = (prefsRes.data?.coach_voice ?? 'mixed') as HillCoachVoice

  const history = (historyRes.data ?? []).filter(m => m.id !== userRow.id)
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = history.map(m => ({
    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }))
  // turno atual: mensagem do usuário embrulhada com <mode> + <user_context>
  messages.push({ role: 'user', content: buildUserMessage('chat', { message, contextXml }) })

  // Anthropic exige começar com 'user' e sem dois papéis iguais seguidos
  while (messages.length && messages[0]?.role === 'assistant') messages.shift()
  const deduped: typeof messages = []
  for (const m of messages) {
    const last = deduped[deduped.length - 1]
    if (last && last.role === m.role) deduped[deduped.length - 1] = m
    else deduped.push(m)
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  const send = (type: string, data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
  }

  const model = HILL_MODELS.chat
  let assembled = ''
  let aborted = false
  const stream = getAnthropic().messages.stream({
    model, max_tokens: HILL_MAX_TOKENS.chat, system: systemPromptFor(voice), messages: deduped,
  })
  const onClose = () => { aborted = true; try { stream.controller.abort() } catch { /* noop */ } }
  req.on('close', onClose)

  try {
    send('start', { userMsgId: userRow.id, conversationId })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        assembled += event.delta.text
        send('delta', { text: event.delta.text })
      }
    }
    const final = await stream.finalMessage()
    const { content, action } = parseActionTag(assembled)
    const cost = calcCost(model, final.usage.input_tokens, final.usage.output_tokens)

    const { data: coachRow } = await supabase.from('hill_coach_messages').insert({
      user_id: user.id, conversation_id: conversationId, mode: 'chat', role: 'coach',
      content, model, tokens_in: final.usage.input_tokens, tokens_out: final.usage.output_tokens,
      cost, ...(action != null ? { action_payload: action as never } : {}),
    }).select('id,created_at').single()

    send('done', {
      conversationId,
      coachMsgId: coachRow?.id ?? null,
      coachCreatedAt: coachRow?.created_at ?? null,
      action: action ?? null,
    })
    res.end()
  } catch (err) {
    console.error('[hill-coach-chat] error:', err instanceof Error ? err.message : err)
    if (assembled.length > 0) {
      await supabase.from('hill_coach_messages').insert({
        user_id: user.id, conversation_id: conversationId, mode: 'chat', role: 'coach',
        content: parseActionTag(assembled).content, model,
      }).then(null, () => {})
    }
    if (!aborted) { send('error', { message: 'erro no coach' }); res.end() }
  } finally {
    req.off('close', onClose)
  }
}
