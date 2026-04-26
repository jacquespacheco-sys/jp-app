import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import { getAuthedClient, GOOGLE_COLORS } from './_google.ts'
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
  const calendarApi = google.calendar({ version: 'v3', auth: authClient })

  const { data } = await calendarApi.calendarList.list({ maxResults: 100 })
  const items = data.items ?? []

  const upserts = items.map(cal => ({
    user_id: user.id,
    google_calendar_id: cal.id ?? '',
    summary: cal.summary ?? '',
    description: cal.description ?? null,
    google_color_id: cal.colorId ?? null,
    custom_color: cal.colorId ? (GOOGLE_COLORS[cal.colorId] ?? null) : null,
    is_primary: cal.primary === true,
    is_visible: true,
    is_default_for_create: cal.primary === true,
    access_role: cal.accessRole ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('calendars')
    .upsert(upserts, { onConflict: 'user_id,google_calendar_id' })

  if (error) return res.status(500).json({ error: error.message })

  const { data: calendars } = await supabase
    .from('calendars')
    .select('*')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })

  return res.status(200).json({
    calendars: (calendars ?? []).map(c => ({
      id: c.id, userId: c.user_id, googleCalendarId: c.google_calendar_id,
      summary: c.summary, description: c.description ?? undefined,
      googleColorId: c.google_color_id ?? undefined,
      customColor: c.custom_color ?? undefined,
      isPrimary: c.is_primary, isVisible: c.is_visible,
      isDefaultForCreate: c.is_default_for_create,
      accessRole: c.access_role ?? undefined,
      syncToken: c.sync_token ?? undefined,
      lastSyncAt: c.last_sync_at ?? undefined,
      createdAt: c.created_at, updatedAt: c.updated_at,
    })),
  })
}
