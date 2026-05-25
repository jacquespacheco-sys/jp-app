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

  const d = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload = {
    first_name: d.firstName,
    last_name: d.lastName ?? null,
    company: d.company ?? null,
    role: d.role ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    address: d.address ?? null,
    birthday: d.birthday ?? null,
    tags: d.tags,
    phase: d.phase ?? null,
    next_contact: d.nextContact ?? null,
    notes: d.notes,

    tier: d.tier ?? null,
    cadence_days: d.cadenceDays ?? null,
    preferred_name: d.preferredName ?? null,
    pronunciation: d.pronunciation ?? null,
    interests: d.interests ?? null,
    conversation_hooks: d.conversationHooks ?? null,
    what_they_value: d.whatTheyValue ?? null,
    their_goals: d.theirGoals ?? null,
    family: d.family ?? null,
    first_met_at: d.firstMetAt ?? null,
    company_start_date: d.companyStartDate ?? null,
    preferred_channel: d.preferredChannel ?? null,
    favor_balance: d.favorBalance ?? null,
    linkedin_url: d.linkedinUrl ?? null,
    twitter_handle: d.twitterHandle ?? null,
    instagram_handle: d.instagramHandle ?? null,
    last_signal: d.lastSignal ?? null,
    last_signal_at: d.lastSignalAt ?? null,
    source_contact_id: d.sourceContactId ?? null,
    source_context: d.sourceContext ?? null,

    user_id: user.id,
    updated_at: now,
  }

  let data: Record<string, unknown>

  if (d.id) {
    const { data: row, error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', d.id)
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

  // Google People push (best-effort — local save já sucedeu).
  // Sem vínculo → cria no Google e guarda o resourceName. Com vínculo → atualiza.
  const googleContactId = data['google_contact_id'] as string | null
  try {
    const { data: userData } = await supabase
      .from('users')
      .select('google_refresh_token')
      .eq('id', user.id)
      .single()

    if (userData?.google_refresh_token) {
      const authClient = await getAuthedClient(userData.google_refresh_token)
      const peopleApi = google.people({ version: 'v1', auth: authClient })

      let birthdayDate: { day: number; month: number } | undefined
      if (d.birthday) {
        const parts = d.birthday.split('/')
        const day = parseInt(parts[0] ?? '0', 10)
        const month = parseInt(parts[1] ?? '0', 10)
        if (day > 0 && month > 0) birthdayDate = { day, month }
      }

      const personFields = 'names,emailAddresses,phoneNumbers,birthdays,organizations'
      const personBody = {
        names: [{ givenName: d.firstName, familyName: d.lastName ?? undefined }],
        emailAddresses: d.email ? [{ value: d.email }] : [],
        phoneNumbers: d.phone ? [{ value: d.phone }] : [],
        birthdays: birthdayDate ? [{ date: birthdayDate }] : [],
        organizations: (d.company || d.role) ? [{ name: d.company ?? undefined, title: d.role ?? undefined }] : [],
      }

      if (googleContactId) {
        const { data: current } = await peopleApi.people.get({
          resourceName: googleContactId,
          personFields,
        })
        if (current?.etag) {
          await peopleApi.people.updateContact({
            resourceName: googleContactId,
            updatePersonFields: personFields,
            requestBody: { etag: current.etag, ...personBody },
          })
        }
      } else {
        const { data: created } = await peopleApi.people.createContact({ requestBody: personBody })
        if (created?.resourceName) {
          await supabase
            .from('contacts')
            .update({ google_contact_id: created.resourceName, synced: true })
            .eq('id', data['id'] as string)
            .eq('user_id', user.id)
          data['google_contact_id'] = created.resourceName
          data['synced'] = true
        }
      }
    }
  } catch (e) {
    console.error('[contacts-save] google push failed:', e instanceof Error ? e.message : e)
  }

  return res.status(d.id ? 200 : 201).json({ contact: mapContact(data) })
}
