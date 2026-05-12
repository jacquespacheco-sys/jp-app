import './_env.js'
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CoachMemoryAcceptSchema } from './_schemas/coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CoachMemoryAcceptSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const { candidateId, content, kind, relevance, expiresAt } = parsed.data

  const supabase = getSupabase()
  const { data: candRow, error: candErr } = await supabase
    .from('coach_memory_candidate')
    .select('*')
    .eq('id', candidateId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (candErr) return res.status(500).json({ error: candErr.message })
  if (!candRow) return res.status(404).json({ error: 'candidata não encontrada' })

  const row = candRow as Record<string, unknown>
  const finalRow = {
    user_id: user.id,
    kind: (kind ?? row['kind']) as 'fact' | 'pattern' | 'promise' | 'concern' | 'preference',
    content: (content ?? row['content']) as string,
    relevance: (relevance ?? row['relevance']) as number,
    expires_at: (expiresAt ?? row['expires_at'] ?? null) as string | null,
    source: 'chat',
  }

  const { data: inserted, error: insErr } = await supabase
    .from('coach_memory').insert(finalRow).select().single()
  if (insErr) return res.status(500).json({ error: insErr.message })

  await supabase.from('coach_memory_candidate')
    .update({ status: 'accepted', decided_at: new Date().toISOString() })
    .eq('id', candidateId).eq('user_id', user.id)

  return res.status(201).json({
    memory: {
      id: inserted.id, userId: inserted.user_id, kind: inserted.kind,
      content: inserted.content, relevance: inserted.relevance,
      ...(inserted.expires_at != null ? { expiresAt: inserted.expires_at } : {}),
      ...(inserted.last_referenced_at != null ? { lastReferencedAt: inserted.last_referenced_at } : {}),
      createdAt: inserted.created_at,
    },
  })
}
