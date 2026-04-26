import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const [{ data: sources }, { data: newsletters }] = await Promise.all([
    supabase.from('sources').select('*').eq('user_id', user.id).order('name'),
    supabase.from('newsletters').select('*').eq('user_id', user.id).order('name'),
  ])

  return res.status(200).json({
    sources: (sources ?? []).map(s => ({
      id: s.id, name: s.name, url: s.url, active: s.active,
      lastFetch: s.last_fetch ?? undefined, createdAt: s.created_at,
    })),
    newsletters: (newsletters ?? []).map(n => ({
      id: n.id, name: n.name, senderEmail: n.sender_email, active: n.active,
      lastFetch: n.last_fetch ?? undefined, createdAt: n.created_at,
    })),
  })
}
