import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SourceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  url: z.string().url(),
  active: z.boolean().default(true),
})

const NewsletterSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  senderEmail: z.string().email(),
  active: z.boolean().default(true),
})

const Schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('source'), ...SourceSchema.shape }),
  z.object({ type: z.literal('newsletter'), ...NewsletterSchema.shape }),
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const supabase = getSupabase()

  if (parsed.data.type === 'source') {
    const { id, name, url, active } = parsed.data
    const payload = { name, url, active, user_id: user.id }

    const query = id
      ? supabase.from('sources').update(payload).eq('id', id).eq('user_id', user.id).select().single()
      : supabase.from('sources').insert(payload).select().single()

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(id ? 200 : 201).json({ source: data })
  }

  const { id, name, senderEmail, active } = parsed.data
  const payload = { name, sender_email: senderEmail, active, user_id: user.id }

  const query = id
    ? supabase.from('newsletters').update(payload).eq('id', id).eq('user_id', user.id).select().single()
    : supabase.from('newsletters').insert(payload).select().single()

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.status(id ? 200 : 201).json({ newsletter: data })
}
