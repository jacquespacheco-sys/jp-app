import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const Schema = z.object({ id: z.string().uuid() })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE' && req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'id obrigatório' })

  const supabase = getSupabase()
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
