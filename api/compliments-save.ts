import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ComplimentSaveSchema } from './_schemas/compliment.js'
import { mapCompliment } from './compliments-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ComplimentSaveSchema.safeParse(req.body)
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
    user_id: user.id,
    contact_id: d.contactId,
    text: d.text,
    received_at: d.receivedAt ?? new Date().toISOString(),
    context: d.context ?? null,
    remind_to_reciprocate_at: d.remindToReciprocateAt ?? null,
  }

  let row: Record<string, unknown>
  if (d.id) {
    const { data, error } = await supabase
      .from('compliments_received')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  } else {
    const { data, error } = await supabase
      .from('compliments_received')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  }

  return res.status(d.id ? 200 : 201).json({ compliment: mapCompliment(row) })
}
