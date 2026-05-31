import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient, GOOGLE_COLORS } from './_google.js'
import { google, type calendar_v3 } from 'googleapis'
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

  const items: calendar_v3.Schema$CalendarListEntry[] = []
  let listPageToken: string | undefined
  do {
    const { data } = await calendarApi.calendarList.list({ maxResults: 100, pageToken: listPageToken })
    items.push(...(data.items ?? []))
    listPageToken = data.nextPageToken ?? undefined
  } while (listPageToken)

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

  // Calendários removidos no Google somem da lista: apaga as linhas órfãs
  // (cascade limpa calendar_events) para não persistirem como fantasmas.
  // Guard: só prunar se o Google devolveu algo — uma lista vazia (blip
  // transitório, escopo degradado) não pode disparar deleção em massa.
  const googleIds = new Set(items.map(cal => cal.id ?? ''))
  const stale = items.length > 0
    ? (calendars ?? []).filter(c => !googleIds.has(c.google_calendar_id))
    : []
  let pruned = false
  if (stale.length > 0) {
    const { error: deleteErr } = await supabase
      .from('calendars')
      .delete()
      .eq('user_id', user.id)
      .in('id', stale.map(c => c.id))
    if (deleteErr) console.error('[calendars-sync] prune failed:', deleteErr.message)
    else pruned = true
  }
  const staleIds = new Set(stale.map(c => c.id))
  const live = pruned
    ? (calendars ?? []).filter(c => !staleIds.has(c.id))
    : (calendars ?? [])

  return res.status(200).json({
    calendars: live.map(c => ({
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
