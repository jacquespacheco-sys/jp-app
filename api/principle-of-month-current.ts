import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { formatInTimeZone } from 'date-fns-tz'
import { PrincipleOfMonthQuerySchema } from './_schemas/principle-of-month.js'
import { mapPrinciple } from './principle-of-month-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = PrincipleOfMonthQuerySchema.safeParse({ month: req.query['month'] })
  if (!parsed.success) return res.status(400).json({ error: 'month inválido' })

  const supabase = getSupabase()

  let month = parsed.data.month
  if (!month) {
    const { data: u } = await supabase.from('users').select('timezone').eq('id', user.id).single()
    const tz = (u?.timezone as string | undefined) ?? 'America/Sao_Paulo'
    month = formatInTimeZone(new Date(), tz, 'yyyy-MM')
  }

  const { data, error } = await supabase
    .from('principle_of_month')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })

  const principle = data ? mapPrinciple(data as Record<string, unknown>) : null

  let appliedCount = 0
  if (principle) {
    const monthStart = `${month}-01T00:00:00Z`
    const [year, mNum] = month.split('-').map(Number)
    const next = mNum === 12 ? `${(year ?? 0) + 1}-01-01T00:00:00Z` : `${year}-${String((mNum ?? 0) + 1).padStart(2, '0')}-01T00:00:00Z`

    const { data: ints } = await supabase
      .from('interactions')
      .select('id, carnegie_tags, contacts!inner(user_id)')
      .eq('contacts.user_id', user.id)
      .gte('date', monthStart)
      .lt('date', next)
      .contains('carnegie_tags', [principle.principle])

    appliedCount = (ints ?? []).length
  }

  return res.status(200).json({ principle, appliedCount })
}
