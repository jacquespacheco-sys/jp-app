import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { Database } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type Row = Database['public']['Tables']['hill_coach_messages']['Row']

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return undefined
}

function mapMessage(r: Row) {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    mode: r.mode,
    role: r.role,
    content: r.content,
    actionPayload: r.action_payload ?? undefined,
    createdAt: r.created_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const id = asString(req.query['id'])

  // Detalhe de uma conversa
  if (id) {
    const { data, error } = await supabase.from('hill_coach_messages')
      .select('*').eq('user_id', user.id).eq('conversation_id', id)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ messages: (data ?? []).map(mapMessage) })
  }

  // Lista de conversas de chat (agrupa por conversation_id, último turno primeiro)
  const { data, error } = await supabase.from('hill_coach_messages')
    .select('conversation_id,role,content,created_at')
    .eq('user_id', user.id).eq('mode', 'chat')
    .order('created_at', { ascending: false }).limit(200)
  if (error) return res.status(500).json({ error: error.message })

  const seen = new Map<string, { conversationId: string; lastRole: string; lastContent: string; lastAt: string; count: number }>()
  for (const m of data ?? []) {
    const existing = seen.get(m.conversation_id)
    if (existing) { existing.count++; continue }
    seen.set(m.conversation_id, {
      conversationId: m.conversation_id, lastRole: m.role, lastContent: m.content, lastAt: m.created_at, count: 1,
    })
  }
  return res.status(200).json({ conversations: [...seen.values()] })
}
