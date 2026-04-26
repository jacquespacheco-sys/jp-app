import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { InteractionSaveSchema } from './_schemas/contact.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = InteractionSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { contactId, date, type, note } = parsed.data
  const supabase = getSupabase()

  // Verify contact belongs to user
  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .single()

  if (!contact) return res.status(404).json({ error: 'contato não encontrado' })

  const { data, error } = await supabase
    .from('interactions')
    .insert({ contact_id: contactId, date, type, note })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    interaction: {
      id: data.id, contactId: data.contact_id,
      date: data.date, type: data.type, note: data.note,
      createdAt: data.created_at,
    },
  })
}
