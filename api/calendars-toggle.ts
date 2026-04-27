import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const Schema = z.object({
  id: z.string().uuid(),
  isVisible: z.boolean(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'dados inválidos' })

  const supabase = getSupabase()
  const { error } = await supabase
    .from('calendars')
    .update({ is_visible: parsed.data.isVisible, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
