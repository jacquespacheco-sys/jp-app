import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const Schema = z.object({ contactId: z.string().uuid() })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse({ contactId: req.query['contactId'] })
  if (!parsed.success) return res.status(400).json({ error: 'contactId obrigatório' })

  const supabase = getSupabase()

  // Verify contact belongs to user
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
    interactions: (data ?? []).map(i => ({
      id: i.id, contactId: i.contact_id,
      date: i.date, type: i.type, note: i.note,
      createdAt: i.created_at,
    })),
  })
}
