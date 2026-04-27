import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { TaskArchiveSchema } from './_schemas/task.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskArchiveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'id obrigatório' })

  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('tasks')
    .update({ archived: true, archived_at: now, updated_at: now })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
