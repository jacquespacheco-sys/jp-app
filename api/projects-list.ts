import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  const { data: existing, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  if (!existing || existing.length === 0) {
    const { data: inbox, error: createErr } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: 'Inbox', color: '#a8ff00' })
      .select()
      .single()

    if (createErr) return res.status(500).json({ error: createErr.message })

    return res.status(200).json({
      projects: [{ id: inbox.id, userId: inbox.user_id, name: inbox.name, color: inbox.color, archived: inbox.archived, createdAt: inbox.created_at, updatedAt: inbox.updated_at }],
    })
  }

  return res.status(200).json({
    projects: existing.map(p => ({ id: p.id, userId: p.user_id, name: p.name, color: p.color, googleTaskListId: p.google_task_list_id ?? undefined, archived: p.archived, createdAt: p.created_at, updatedAt: p.updated_at })),
  })
}
