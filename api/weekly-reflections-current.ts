import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { formatInTimeZone } from 'date-fns-tz'
import { mapWeeklyReflection } from './weekly-reflections-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const queryWeek = typeof req.query['week'] === 'string' ? req.query['week'] : undefined
  if (queryWeek && !/^\d{4}-W\d{2}$/.test(queryWeek)) {
    return res.status(400).json({ error: 'week inválido' })
  }

  const supabase = getSupabase()

  let week = queryWeek
  if (!week) {
    const { data: u } = await supabase.from('users').select('timezone').eq('id', user.id).single()
    const tz = (u?.timezone as string | undefined) ?? 'America/Sao_Paulo'
    week = formatInTimeZone(new Date(), tz, "yyyy-'W'II")
  }

  const { data, error } = await supabase
    .from('weekly_reflections')
    .select('*')
    .eq('user_id', user.id)
    .eq('week', week)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    reflection: data ? mapWeeklyReflection(data as Record<string, unknown>) : null,
  })
}
