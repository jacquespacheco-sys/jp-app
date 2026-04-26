import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { EventSaveSchema } from './_schemas/event.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

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

  const payload = {
    summary,
    status,
    calendar_id: calendarId,
    start_at: startAt,
    end_at: endAt,
    all_day: allDay,
    description: description ?? null,
    location: location ?? null,
    timezone: timezone ?? null,
    user_id: user.id,
    source: 'jp_app' as const,
    synced: false,
    updated_at: now,
  }

  if (id) {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({
      event: {
        id: data.id, userId: data.user_id, calendarId: data.calendar_id,
        summary: data.summary, description: data.description ?? undefined,
        location: data.location ?? undefined,
        startAt: data.start_at, endAt: data.end_at,
        allDay: data.all_day, timezone: data.timezone ?? undefined,
        status: data.status as 'confirmed' | 'tentative' | 'cancelled',
        isOrganizer: data.is_organizer,
        source: data.source as 'google' | 'jp_app' | 'task_block',
        synced: data.synced, createdAt: data.created_at, updatedAt: data.updated_at,
      },
    })
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(payload)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    event: {
      id: data.id, userId: data.user_id, calendarId: data.calendar_id,
      summary: data.summary, description: data.description ?? undefined,
      location: data.location ?? undefined,
      startAt: data.start_at, endAt: data.end_at,
      allDay: data.all_day, timezone: data.timezone ?? undefined,
      status: data.status as 'confirmed' | 'tentative' | 'cancelled',
      isOrganizer: data.is_organizer,
      source: data.source as 'google' | 'jp_app' | 'task_block',
      synced: data.synced, createdAt: data.created_at, updatedAt: data.updated_at,
    },
  })
}
