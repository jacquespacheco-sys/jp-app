import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('briefings')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(30)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    briefings: (data ?? []).map(b => ({
      id: b.id, userId: b.user_id,
      date: b.date, highlight: b.highlight,
      content: b.content,
      emailSent: b.email_sent, emailSentAt: b.email_sent_at ?? undefined,
      model: b.model, tokenCount: b.token_count ?? undefined,
      cost: b.cost ?? undefined, createdAt: b.created_at,
    })),
  })
}
