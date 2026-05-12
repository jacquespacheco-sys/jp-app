import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachChatHistorySchema } from './_schemas/coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachChatHistorySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'query inválida' })
  }
  const { before, limit } = parsed.data

  const supabase = getSupabase()
  let q = supabase.from('coach_log')
    .select('id,direction,kind,content_md,created_at')
    .eq('user_id', user.id)
    .in('kind', ['chat', 'check_in', 'callout', 'celebration'])
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)

  const { data, error } = await q
  if (error) return res.status(500).json({ error: error.message })

  type Row = { id: string; direction: string; kind: string; content_md: string; created_at: string }
  const messages = ((data ?? []) as Row[]).map(r => ({
    id: r.id,
    direction: r.direction,
    kind: r.kind,
    contentMd: r.content_md,
    createdAt: r.created_at,
  }))
  // Retornar em ordem ascendente (mais antiga primeiro) pro frontend renderizar de cima pra baixo
  return res.status(200).json({ messages: messages.reverse() })
}
