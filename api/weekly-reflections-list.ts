import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface WeeklyReflectionRow {
  id: string
  user_id: string
  week: string
  marked_me_contact_id: string | null
  marked_me_why: string | null
  let_down_contact_id: string | null
  let_down_why: string | null
  reconnect_contact_id: string | null
  reconnect_handled: boolean
  created_at: string
}

export function mapWeeklyReflection(raw: Record<string, unknown>) {
  const r = raw as Partial<WeeklyReflectionRow>
  return {
    id: r.id as string,
    userId: r.user_id as string,
    week: r.week as string,
    reconnectHandled: !!r.reconnect_handled,
    createdAt: r.created_at as string,
    ...(r.marked_me_contact_id != null ? { markedMeContactId: r.marked_me_contact_id } : {}),
    ...(r.marked_me_why != null ? { markedMeWhy: r.marked_me_why } : {}),
    ...(r.let_down_contact_id != null ? { letDownContactId: r.let_down_contact_id } : {}),
    ...(r.let_down_why != null ? { letDownWhy: r.let_down_why } : {}),
    ...(r.reconnect_contact_id != null ? { reconnectContactId: r.reconnect_contact_id } : {}),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('weekly_reflections')
    .select('*')
    .eq('user_id', user.id)
    .order('week', { ascending: false })
    .limit(52)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    reflections: (data ?? []).map(r => mapWeeklyReflection(r as Record<string, unknown>)),
  })
}
