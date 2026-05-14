import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface GratitudeRow {
  id: string
  user_id: string
  contact_id: string | null
  text: string
  shared: boolean
  shared_at: string | null
  shared_channel: string | null
  created_at: string
}

export function mapGratitudeEntry(raw: Record<string, unknown>) {
  const r = raw as Partial<GratitudeRow>
  return {
    id: r.id as string,
    userId: r.user_id as string,
    text: r.text as string,
    shared: !!r.shared,
    createdAt: r.created_at as string,
    ...(r.contact_id != null ? { contactId: r.contact_id } : {}),
    ...(r.shared_at != null ? { sharedAt: r.shared_at } : {}),
    ...(r.shared_channel != null ? { sharedChannel: r.shared_channel as 'whatsapp' | 'email' | 'linkedin' | 'sms' | 'phone' } : {}),
  }
}

const Schema = z.object({
  contactId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(3000).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse({
    contactId: req.query['contactId'],
    year: req.query['year'],
    limit: req.query['limit'],
  })
  if (!parsed.success) return res.status(400).json({ error: 'query inválida' })

  const supabase = getSupabase()
  let q = supabase.from('gratitude_entries').select('*').eq('user_id', user.id)
  if (parsed.data.contactId) q = q.eq('contact_id', parsed.data.contactId)
  if (parsed.data.year != null) {
    q = q.gte('created_at', `${parsed.data.year}-01-01T00:00:00Z`)
         .lt('created_at', `${parsed.data.year + 1}-01-01T00:00:00Z`)
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(parsed.data.limit)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    entries: (data ?? []).map(r => mapGratitudeEntry(r as Record<string, unknown>)),
  })
}
