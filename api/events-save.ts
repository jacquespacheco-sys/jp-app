import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import { EventSaveSchema } from './_schemas/event.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r.id, userId: r.user_id, calendarId: r.calendar_id,
    googleEventId: r.google_event_id ?? undefined,
    summary: r.summary, description: r.description ?? undefined,
    location: r.location ?? undefined,
    startAt: r.start_at, endAt: r.end_at,
    allDay: r.all_day, timezone: r.timezone ?? undefined,
    status: r.status as 'confirmed' | 'tentative' | 'cancelled',
    isOrganizer: r.is_organizer,
    source: r.source as 'google' | 'jp_app' | 'task_block',
    synced: r.synced, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = EventSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { id, calendarId, description, location, timezone, startAt, endAt, allDay, summary, status } = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  // For updates, don't overwrite source (keep 'google' if it was from Google)
  const insertPayload = {
    summary, status, calendar_id: calendarId,
    start_at: startAt, end_at: endAt, all_day: allDay,
    description: description ?? null, location: location ?? null,
    timezone: timezone ?? null, user_id: user.id,
    source: 'jp_app' as const, synced: false, updated_at: now,
  }
  const updatePayload = {
    summary, status, calendar_id: calendarId,
    start_at: startAt, end_at: endAt, all_day: allDay,
    description: description ?? null, location: location ?? null,
    timezone: timezone ?? null, updated_at: now,
  }

  let row: Record<string, unknown>
  let httpStatus: number

  if (id) {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(insertPayload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
    httpStatus = 201
  }

  // Push to Google Calendar (best-effort — save already succeeded)
  try {
    const [calRes, userRes] = await Promise.all([
      supabase.from('calendars').select('google_calendar_id').eq('id', calendarId).eq('user_id', user.id).single(),
      supabase.from('users').select('google_refresh_token').eq('id', user.id).single(),
    ])
    const googleCalId = calRes.data?.google_calendar_id
    const refreshToken = userRes.data?.google_refresh_token

    if (!googleCalId) {
      console.warn('[events-save] no google_calendar_id for calendarId:', calendarId, 'calRes error:', calRes.error?.message)
    }
    if (!refreshToken) {
      console.warn('[events-save] no google_refresh_token for user:', user.id)
    }

    if (googleCalId && refreshToken) {
      const authClient = await getAuthedClient(refreshToken)
      const gcal = google.calendar({ version: 'v3', auth: authClient })

      const body = {
        summary,
        description: description ?? undefined,
        location: location ?? undefined,
        start: allDay
          ? { date: startAt.slice(0, 10) }
          : { dateTime: startAt, timeZone: timezone ?? 'America/Sao_Paulo' },
        end: allDay
          ? { date: endAt.slice(0, 10) }
          : { dateTime: endAt, timeZone: timezone ?? 'America/Sao_Paulo' },
      }

      const existingGoogleId = row['google_event_id'] as string | null

      if (id && existingGoogleId) {
        await gcal.events.patch({ calendarId: googleCalId, eventId: existingGoogleId, requestBody: body })
        await supabase.from('calendar_events').update({ synced: true }).eq('id', row['id'] as string)
        row['synced'] = true
      } else if (!id) {
        const { data: gcalEv } = await gcal.events.insert({ calendarId: googleCalId, requestBody: body })
        if (gcalEv?.id) {
          await supabase
            .from('calendar_events')
            .update({ google_event_id: gcalEv.id, synced: true })
            .eq('id', row['id'] as string)
          row['google_event_id'] = gcalEv.id
          row['synced'] = true
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[events-save] google push failed:', msg)
    if (e && typeof e === 'object' && 'response' in e) {
      const resp = (e as { response?: { data?: unknown } }).response
      console.error('[events-save] google error details:', JSON.stringify(resp?.data))
    }
  }

  return res.status(httpStatus).json({ event: mapRow(row) })
}
