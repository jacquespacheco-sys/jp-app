import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { SpecialDateSaveSchema } from './_schemas/special-date.js'
import { mapSpecialDate } from './special-dates-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = SpecialDateSaveSchema.safeParse(req.body)
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
    label: d.label,
    type: d.type,
    date_anniversary: d.dateAnniversary ?? null,
    date_full: d.dateFull ?? null,
    recurring: d.recurring,
    lead_days: d.leadDays,
    silence_days: d.silenceDays ?? null,
    private_note: d.privateNote ?? null,
    source: d.source,
  }

  let row: Record<string, unknown>
  if (d.id) {
    const { data, error } = await supabase
      .from('special_dates')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  } else {
    const { data, error } = await supabase
      .from('special_dates')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  }

  return res.status(d.id ? 200 : 201).json({ specialDate: mapSpecialDate(row) })
}
