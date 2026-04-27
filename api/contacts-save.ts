import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ContactSaveSchema } from './_schemas/contact.js'
import { mapContact } from './contacts-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ContactSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { id, firstName, lastName, company, role, email, phone, address, birthday, tags, phase, nextContact, notes } = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload = {
    first_name: firstName,
    last_name: lastName ?? null,
    company: company ?? null,
    role: role ?? null,
    email: email ?? null,
    phone: phone ?? null,
    address: address ?? null,
    birthday: birthday ?? null,
    tags,
    phase: phase ?? null,
    next_contact: nextContact ?? null,
    notes,
    user_id: user.id,
    updated_at: now,
  }

  if (id) {
    const { data, error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ contact: mapContact(data as Record<string, unknown>) })
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert(payload)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ contact: mapContact(data as Record<string, unknown>) })
}
