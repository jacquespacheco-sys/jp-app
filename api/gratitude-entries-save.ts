import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { GratitudeEntrySaveSchema } from './_schemas/gratitude-entry.js'
import { mapGratitudeEntry } from './gratitude-entries-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = GratitudeEntrySaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  if (d.contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', d.contactId)
      .eq('user_id', user.id)
      .single()
    if (!contact) return res.status(404).json({ error: 'contato não encontrado' })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('gratitude_entries')
    .insert({
      user_id: user.id,
      contact_id: d.contactId ?? null,
      text: d.text,
      shared: d.shared,
      shared_at: d.shared ? now : null,
      shared_channel: d.sharedChannel ?? null,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({ entry: mapGratitudeEntry(data as Record<string, unknown>) })
}
