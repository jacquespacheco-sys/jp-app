import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { InteractionSaveSchema } from './_schemas/contact.js'
import { mapInteraction } from './interactions-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = InteractionSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', d.contactId)
    .eq('user_id', user.id)
    .single()

  if (!contact) return res.status(404).json({ error: 'contato não encontrado' })

  const payload = {
    contact_id: d.contactId,
    date: d.date,
    type: d.type,
    note: d.note,
    initiator: d.initiator ?? null,
    sentiment: d.sentiment ?? null,
    topics_discussed: d.topicsDiscussed ?? null,
    carnegie_tags: d.carnegieTags ?? null,
    interaction_tags: d.interactionTags ?? null,
    compliment_text: d.complimentText ?? null,
    referral_from_id: d.referralFromId ?? null,
    new_learning: d.newLearning ?? null,
    promise_made: d.promiseMade ?? null,
  }

  const { data, error } = await supabase
    .from('interactions')
    .insert(payload)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    interaction: mapInteraction(data as Record<string, unknown>),
  })
}
