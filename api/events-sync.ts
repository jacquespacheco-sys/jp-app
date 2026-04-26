import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { getAuthedClient } from './_google.ts'
import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function toISO(dt: string | null | undefined, date: string | null | undefined): string {
  if (dt) return new Date(dt).toISOString()
  if (date) return `${date}T00:00:00.000Z`
  return new Date().toISOString()
}

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

  const { data: calendars } = await supabase
    .from('calendars')
    .select('id, google_calendar_id')
    .eq('user_id', user.id)
    .eq('is_visible', true)

  console.log('[events-sync] calendars found:', calendars?.length ?? 0)
  if (!calendars?.length) return res.status(200).json({ synced: 0 })

  const authClient = await getAuthedClient(userData.google_refresh_token)
  const calendarApi = google.calendar({ version: 'v3', auth: authClient })

  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString()

  let totalSynced = 0

  for (const cal of calendars) {
    let pageToken: string | undefined
    const upserts: object[] = []

    do {
      const { data } = await calendarApi.events.list({
        calendarId: cal.google_calendar_id,
        timeMin, timeMax,
        singleEvents: true,
        maxResults: 250,
        pageToken,
      })

      for (const ev of data.items ?? []) {
        if (!ev.id) continue
        const allDay = !ev.start?.dateTime
        upserts.push({
          user_id: user.id,
          calendar_id: cal.id,
          google_event_id: ev.id,
          ical_uid: ev.iCalUID ?? null,
          summary: ev.summary ?? '(sem título)',
          description: ev.description ?? null,
          location: ev.location ?? null,
          start_at: toISO(ev.start?.dateTime, ev.start?.date),
          end_at: toISO(ev.end?.dateTime, ev.end?.date),
          all_day: allDay,
          timezone: ev.start?.timeZone ?? null,
          status: ev.status ?? 'confirmed',
          recurrence: ev.recurrence ?? null,
          recurring_event_id: ev.recurringEventId ?? null,
          attendees: ev.attendees ?? null,
          organizer_email: ev.organizer?.email ?? null,
          is_organizer: ev.organizer?.self === true,
          source: 'google',
          synced: true,
          etag: ev.etag ?? null,
          updated_at: new Date().toISOString(),
        })
      }

      pageToken = data.nextPageToken ?? undefined
    } while (pageToken)

    console.log(`[events-sync] cal ${cal.google_calendar_id}: ${upserts.length} events to upsert`)
    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('calendar_events')
        .upsert(upserts as never[], { onConflict: 'user_id,google_event_id' })
      if (upsertErr) console.error('[events-sync] upsert error:', upsertErr.message)
      else totalSynced += upserts.length
    }
  }

  // Update last_sync_at
  await supabase
    .from('calendars')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return res.status(200).json({ synced: totalSynced })
}
