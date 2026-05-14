import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { formatInTimeZone } from 'date-fns-tz'
import { mapSpecialDate } from './special-dates-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function dateRangeDDMM(tz: string, days: number): { ddmm: string[]; map: Map<string, string> } {
  const ddmm: string[] = []
  const map = new Map<string, string>()
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86400000)
    const key = formatInTimeZone(d, tz, 'dd/MM')
    const isoDate = formatInTimeZone(d, tz, 'yyyy-MM-dd')
    ddmm.push(key)
    if (!map.has(key)) map.set(key, isoDate)
  }
  return { ddmm, map }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const days = Math.min(60, Math.max(1, parseInt(String(req.query['days'] ?? '14'), 10) || 14))

  const supabase = getSupabase()
  const { data: u } = await supabase.from('users').select('timezone').eq('id', user.id).single()
  const tz = (u?.timezone as string | undefined) ?? 'America/Sao_Paulo'

  const { ddmm, map } = dateRangeDDMM(tz, days)
  const todayStr = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')
  const endStr = formatInTimeZone(new Date(Date.now() + days * 86400000), tz, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('special_dates')
    .select('*')
    .eq('user_id', user.id)
    .or(
      `date_anniversary.in.(${ddmm.map(d => `"${d}"`).join(',')}),and(date_full.gte.${todayStr},date_full.lte.${endStr})`
    )

  if (error) return res.status(500).json({ error: error.message })

  const enriched = (data ?? []).map(raw => {
    const sd = mapSpecialDate(raw as Record<string, unknown>)
    let occurrenceDate = sd.dateFull
    if (!occurrenceDate && sd.dateAnniversary) {
      occurrenceDate = map.get(sd.dateAnniversary) ?? null as unknown as undefined
    }
    if (!occurrenceDate) return null
    const daysUntil = Math.round(
      (new Date(`${occurrenceDate}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) / 86400000
    )
    return { ...sd, occurrenceDate, daysUntil }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  enriched.sort((a, b) => a.daysUntil - b.daysUntil)

  return res.status(200).json({ specialDates: enriched })
}
