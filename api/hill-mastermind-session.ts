import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { MastermindSessionSchema, SessionDecisionSchema } from './_schemas/hill.js'
import { generateMastermindResponses, mapSession } from './_hill-mastermind.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 60

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  // Lista de reuniões
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('hill_mastermind_sessions')
      .select('*').eq('user_id', user.id)
      .order('held_at', { ascending: false }).limit(30)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ sessions: (data ?? []).map(mapSession) })
  }

  // Convocar reunião: gera as respostas das vozes ativas
  if (req.method === 'POST') {
    const parsed = MastermindSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
    }
    const { data: counselors, error: cErr } = await supabase.from('hill_mastermind_counselors')
      .select('id,name,archetype,context_prompt').eq('user_id', user.id).eq('is_active', true)
    if (cErr) return res.status(500).json({ error: cErr.message })
    if (!counselors || counselors.length === 0) {
      return res.status(400).json({ error: 'adicione ao menos um conselheiro antes de convocar' })
    }

    let responses
    try {
      responses = await generateMastermindResponses(counselors, parsed.data.question)
    } catch (e) {
      console.error('[hill-mastermind-session]', e instanceof Error ? e.message : e)
      return res.status(502).json({ error: 'o conselho não respondeu agora' })
    }
    if (responses.length === 0) return res.status(502).json({ error: 'o conselho não respondeu agora' })

    const { data, error } = await supabase.from('hill_mastermind_sessions').insert({
      user_id: user.id,
      question: parsed.data.question,
      counselor_responses: responses as never,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ session: mapSession(data) })
  }

  // Registrar a decisão tomada após ouvir
  if (req.method === 'PATCH') {
    const parsed = SessionDecisionSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
    }
    const d = parsed.data
    const { data, error } = await supabase.from('hill_mastermind_sessions')
      .update({ user_decision: d.userDecision, ...(d.decisionReason != null ? { decision_reason: d.decisionReason } : {}) })
      .eq('id', d.id).eq('user_id', user.id).select().maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'reunião não encontrada' })
    return res.status(200).json({ session: mapSession(data) })
  }

  return res.status(405).end()
}
