import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface InteractionRow {
  id: string
  contact_id: string
  date: string
  type: string
  note: string | null
  created_at: string

  initiator: string | null
  sentiment: string | null
  topics_discussed: string[] | null
  carnegie_tags: string[] | null
  interaction_tags: string[] | null
  compliment_text: string | null
  referral_from_id: string | null
  new_learning: string | null
  promise_made: string | null
}

export function mapInteraction(raw: Record<string, unknown>) {
  const r = raw as Partial<InteractionRow>
  return {
    id: r.id as string,
    contactId: r.contact_id as string,
    date: r.date as string,
    type: r.type as string,
    note: (r.note ?? '') as string,
    createdAt: r.created_at as string,
    ...(r.initiator != null ? { initiator: r.initiator } : {}),
    ...(r.sentiment != null ? { sentiment: r.sentiment } : {}),
    ...(r.topics_discussed != null ? { topicsDiscussed: r.topics_discussed } : { topicsDiscussed: [] }),
    ...(r.carnegie_tags != null ? { carnegieTags: r.carnegie_tags } : { carnegieTags: [] }),
    ...(r.interaction_tags != null ? { interactionTags: r.interaction_tags } : { interactionTags: [] }),
    ...(r.compliment_text != null ? { complimentText: r.compliment_text } : {}),
    ...(r.referral_from_id != null ? { referralFromId: r.referral_from_id } : {}),
    ...(r.new_learning != null ? { newLearning: r.new_learning } : {}),
    ...(r.promise_made != null ? { promiseMade: r.promise_made } : {}),
  }
}

const Schema = z.object({ contactId: z.string().uuid() })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse({ contactId: req.query['contactId'] })
  if (!parsed.success) return res.status(400).json({ error: 'contactId obrigatório' })

  const supabase = getSupabase()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', parsed.data.contactId)
    .eq('user_id', user.id)
    .single()

  if (!contact) return res.status(404).json({ error: 'contato não encontrado' })

  const { data, error } = await supabase
    .from('interactions')
    .select('*')
    .eq('contact_id', parsed.data.contactId)
    .order('date', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    interactions: (data ?? []).map(i => mapInteraction(i as Record<string, unknown>)),
  })
}
