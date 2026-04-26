import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const start = req.query['start']
  const end = req.query['end']

  if (typeof start !== 'string' || typeof end !== 'string') {
    return res.status(400).json({ error: 'start e end obrigatórios (ISO)' })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .gte('start_at', start)
    .lte('start_at', end)
    .order('start_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const events = (data ?? []).map(e => ({
    id: e.id, userId: e.user_id, calendarId: e.calendar_id,
    googleEventId: e.google_event_id ?? undefined,
    icalUid: e.ical_uid ?? undefined,
    summary: e.summary,
    description: e.description ?? undefined,
    location: e.location ?? undefined,
    startAt: e.start_at, endAt: e.end_at,
    allDay: e.all_day,
    timezone: e.timezone ?? undefined,
    status: e.status as 'confirmed' | 'tentative' | 'cancelled',
    recurrence: e.recurrence ?? undefined,
    recurringEventId: e.recurring_event_id ?? undefined,
    attendees: (e.attendees as Array<{ email: string; displayName?: string; responseStatus?: string }> | null) ?? undefined,
    organizerEmail: e.organizer_email ?? undefined,
    isOrganizer: e.is_organizer,
    source: e.source as 'google' | 'jp_app' | 'task_block',
    taskId: e.task_id ?? undefined,
    synced: e.synced,
    etag: e.etag ?? undefined,
    createdAt: e.created_at, updatedAt: e.updated_at,
  }))

  return res.status(200).json({ events })
}
