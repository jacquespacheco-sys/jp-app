import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// news_items table not in generated database.ts yet — see 0009_news.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

const Schema = z.object({ id: z.string().uuid(), favorited: z.boolean() })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'inválido' })
  const { error } = await db().from('news_items')
    .update({ favorited: parsed.data.favorited })
    .eq('id', parsed.data.id).eq('user_id', user.id)
  if (error) return res.status(500).json({ error: (error as { message: string }).message })
  return res.status(200).json({ ok: true })
}
