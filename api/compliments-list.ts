import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ComplimentRow {
  id: string
  user_id: string
  contact_id: string
  text: string
  received_at: string
  context: string | null
  remind_to_reciprocate_at: string | null
  reciprocated: boolean
  reciprocated_at: string | null
  reciprocation_note: string | null
  created_at: string
}

export function mapCompliment(raw: Record<string, unknown>) {
  const r = raw as Partial<ComplimentRow>
  return {
    id: r.id as string,
    userId: r.user_id as string,
    contactId: r.contact_id as string,
    text: r.text as string,
    receivedAt: r.received_at as string,
    reciprocated: !!r.reciprocated,
    createdAt: r.created_at as string,
    ...(r.context != null ? { context: r.context } : {}),
    ...(r.remind_to_reciprocate_at != null ? { remindToReciprocateAt: r.remind_to_reciprocate_at } : {}),
    ...(r.reciprocated_at != null ? { reciprocatedAt: r.reciprocated_at } : {}),
    ...(r.reciprocation_note != null ? { reciprocationNote: r.reciprocation_note } : {}),
  }
}

const Schema = z.object({
  contactId: z.string().uuid().optional(),
  pending: z.enum(['true', 'false']).optional(),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse({
    contactId: req.query['contactId'],
    pending: req.query['pending'],
  })
  if (!parsed.success) return res.status(400).json({ error: 'query inválida' })

  const supabase = getSupabase()
  let q = supabase.from('compliments_received').select('*').eq('user_id', user.id)
  if (parsed.data.contactId) q = q.eq('contact_id', parsed.data.contactId)
  if (parsed.data.pending === 'true') {
    q = q.eq('reciprocated', false).lte('remind_to_reciprocate_at', new Date().toISOString())
  }

  const { data, error } = await q.order('received_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    compliments: (data ?? []).map(r => mapCompliment(r as Record<string, unknown>)),
  })
}
