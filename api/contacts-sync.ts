import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { getAuthedClient } from './_google.ts'
import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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

  const upserts: object[] = []
  let pageToken: string | undefined

  do {
    const { data } = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 1000,
      personFields: 'names,emailAddresses,phoneNumbers,birthdays,organizations,metadata',
      ...(pageToken ? { pageToken } : {}),
    })

    for (const person of data.connections ?? []) {
      const resourceName = person.resourceName
      if (!resourceName) continue

      const name = person.names?.[0]
      if (!name?.givenName) continue

      const birthday = person.birthdays?.[0]?.date
      let birthdayStr: string | null = null
      if (birthday?.month && birthday?.day) {
        birthdayStr = `${String(birthday.day).padStart(2, '0')}/${String(birthday.month).padStart(2, '0')}`
      }

      const org = person.organizations?.[0]

      upserts.push({
        user_id: user.id,
        first_name: name.givenName,
        last_name: name.familyName ?? null,
        email: person.emailAddresses?.[0]?.value ?? null,
        phone: person.phoneNumbers?.[0]?.value ?? null,
        company: org?.name ?? null,
        role: org?.title ?? null,
        birthday: birthdayStr,
        google_contact_id: resourceName,
        synced: true,
        updated_at: new Date().toISOString(),
      })
    }

    pageToken = data.nextPageToken ?? undefined
  } while (pageToken)

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('contacts')
      .upsert(upserts as never[], { onConflict: 'user_id,google_contact_id' })

    if (error) return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ synced: upserts.length })
}
