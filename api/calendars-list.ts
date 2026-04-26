import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('calendars')
    .select('*')
    .eq('user_id', user.id)
    .order('is_primary', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  // Also check if Google is connected
  const { data: userData } = await supabase
    .from('users')
    .select('google_refresh_token')
    .eq('id', user.id)
    .single()

  return res.status(200).json({
    googleConnected: !!userData?.google_refresh_token,
    calendars: (data ?? []).map(c => ({
      id: c.id, userId: c.user_id, googleCalendarId: c.google_calendar_id,
      summary: c.summary, description: c.description ?? undefined,
      googleColorId: c.google_color_id ?? undefined,
      customColor: c.custom_color ?? undefined,
      isPrimary: c.is_primary, isVisible: c.is_visible,
      isDefaultForCreate: c.is_default_for_create,
      accessRole: c.access_role ?? undefined,
      createdAt: c.created_at, updatedAt: c.updated_at,
    })),
  })
}
