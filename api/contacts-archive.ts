import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const Schema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'dados inválidos' })

  const { id, archived } = parsed.data
  const supabase = getSupabase()

  const { error } = await supabase
    .from('contacts')
    .update({
      archived,
      archived_at: archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
