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

  return res.status(200).json({
    principle: data ? mapPrinciple(data as Record<string, unknown>) : null,
  })
}
