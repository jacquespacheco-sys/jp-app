import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const Schema = z.object({ id: z.string().uuid() })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE' && req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'id obrigatório' })

  const supabase = getSupabase()

  // Fetch event details before deleting (need google_event_id + calendar_id)
  const { data: ev } = await supabase
    .from('calendar_events')
    .select('google_event_id, calendar_id')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  // Delete from Google Calendar (best-effort)
  if (ev?.google_event_id && ev.calendar_id) {
    try {
      const [calRes, userRes] = await Promise.all([
        supabase.from('calendars').select('google_calendar_id').eq('id', ev.calendar_id).eq('user_id', user.id).single(),
        supabase.from('users').select('google_refresh_token').eq('id', user.id).single(),
      ])
      const googleCalId = calRes.data?.google_calendar_id
      const refreshToken = userRes.data?.google_refresh_token

      if (googleCalId && refreshToken) {
        const authClient = await getAuthedClient(refreshToken)
        const gcal = google.calendar({ version: 'v3', auth: authClient })
        await gcal.events.delete({ calendarId: googleCalId, eventId: ev.google_event_id })
      }
    } catch (e) {
      console.error('[events-delete] google delete failed:', e instanceof Error ? e.message : e)
    }
  }

  return res.status(200).json({ ok: true })
}
