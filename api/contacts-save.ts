import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
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

  let data: Record<string, unknown>

  if (id) {
    const { data: row, error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    data = row as Record<string, unknown>
  } else {
    const { data: row, error } = await supabase
      .from('contacts')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    data = row as Record<string, unknown>
  }

  // Push update back to Google Contacts (best-effort, updates only)
  const googleContactId = data['google_contact_id'] as string | null
  if (id && googleContactId) {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('google_refresh_token')
        .eq('id', user.id)
        .single()

      if (userData?.google_refresh_token) {
        const authClient = await getAuthedClient(userData.google_refresh_token)
        const peopleApi = google.people({ version: 'v1', auth: authClient })

        // Fetch current person to get required etag
        const { data: current } = await peopleApi.people.get({
          resourceName: googleContactId,
          personFields: 'names,emailAddresses,phoneNumbers,birthdays,organizations',
        })

        if (current?.etag) {
          // Parse birthday "DD/MM" → { day, month }
          let birthdayDate: { day: number; month: number } | undefined
          if (birthday) {
            const parts = birthday.split('/')
            const day = parseInt(parts[0] ?? '0', 10)
            const month = parseInt(parts[1] ?? '0', 10)
            if (day > 0 && month > 0) birthdayDate = { day, month }
          }

          await peopleApi.people.updateContact({
            resourceName: googleContactId,
            updatePersonFields: 'names,emailAddresses,phoneNumbers,birthdays,organizations',
            requestBody: {
              etag: current.etag,
              names: [{ givenName: firstName, familyName: lastName ?? undefined }],
              emailAddresses: email ? [{ value: email }] : [],
              phoneNumbers: phone ? [{ value: phone }] : [],
              birthdays: birthdayDate ? [{ date: birthdayDate }] : [],
              organizations: (company || role) ? [{ name: company ?? undefined, title: role ?? undefined }] : [],
            },
          })
        }
      }
    } catch (e) {
      console.error('[contacts-save] google push failed:', e instanceof Error ? e.message : e)
    }
  }

  return res.status(id ? 200 : 201).json({ contact: mapContact(data) })
}
