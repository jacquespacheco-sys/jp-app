import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// New tables not in generated database.ts yet — see 0008_notes.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const parsed = z.object({ id: z.string().uuid() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'id inválido' })
  const { error } = await db().from('note_tags').delete().eq('id', parsed.data.id).eq('user_id', user.id)
  if (error) return res.status(500).json({ error: (error as { message: string }).message })
  return res.status(200).json({ ok: true })
}
