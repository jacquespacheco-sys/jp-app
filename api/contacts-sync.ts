import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const CHUNK = 500

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: userData } = await supabase
    .from('users')
    .select('google_refresh_token')
    .eq('id', user.id)
    .single()

  if (!userData?.google_refresh_token) {
    return res.status(400).json({ error: 'Google não conectado' })
  }

  const authClient = await getAuthedClient(userData.google_refresh_token)
  const people = google.people({ version: 'v1', auth: authClient })

  const contacts: Array<{
    first_name: string
    last_name: string | null
    email: string | null
    phone: string | null
    company: string | null
    role: string | null
    birthday: string | null
    google_contact_id: string
  }> = []

  let pageToken: string | undefined

  do {
    const { data } = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,birthdays,organizations',
      ...(pageToken ? { pageToken } : {}),
    })

    for (const person of data.connections ?? []) {
      if (!person.resourceName) continue
      const name = person.names?.[0]
      if (!name?.givenName) continue

      const birthday = person.birthdays?.[0]?.date
      let birthdayStr: string | null = null
      if (birthday?.month && birthday?.day) {
        birthdayStr = `${String(birthday.day).padStart(2, '0')}/${String(birthday.month).padStart(2, '0')}`
      }

      const org = person.organizations?.[0]
      contacts.push({
        first_name: name.givenName,
        last_name: name.familyName ?? null,
        email: person.emailAddresses?.[0]?.value ?? null,
        phone: person.phoneNumbers?.[0]?.value ?? null,
        company: org?.name ?? null,
        role: org?.title ?? null,
        birthday: birthdayStr,
        google_contact_id: person.resourceName,
      })
    }

    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)

  const now = new Date().toISOString()
  let synced = 0

  for (let i = 0; i < contacts.length; i += CHUNK) {
    const chunk = contacts.slice(i, i + CHUNK)

    // Pass 1 — insert new contacts with all Google fields (company/role included).
    // ignoreDuplicates: true means existing records are skipped entirely here.
    const insertRows = chunk.map(c => ({
      user_id: user.id,
      ...c,
      synced: true,
      updated_at: now,
    }))
    const { error: e1 } = await supabase
      .from('contacts')
      .upsert(insertRows, { onConflict: 'user_id,google_contact_id', ignoreDuplicates: true })
    if (e1) {
      console.error('[contacts-sync] insert error:', e1.message)
      return res.status(500).json({ error: e1.message })
    }

    // Pass 2 — update identity fields for existing contacts.
    // company/role intentionally excluded so user edits are preserved.
    const updateRows = chunk.map(c => ({
      user_id: user.id,
      google_contact_id: c.google_contact_id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      birthday: c.birthday,
      synced: true,
      updated_at: now,
    }))
    const { error: e2 } = await supabase
      .from('contacts')
      .upsert(updateRows, { onConflict: 'user_id,google_contact_id' })
    if (e2) {
      console.error('[contacts-sync] update error:', e2.message)
      return res.status(500).json({ error: e2.message })
    }

    synced += chunk.length
  }

  return res.status(200).json({ synced })
}
