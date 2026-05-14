import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { PrincipleOfMonthSaveSchema } from './_schemas/principle-of-month.js'
import { mapPrinciple } from './principle-of-month-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = PrincipleOfMonthSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('principle_of_month')
    .upsert({
      user_id: user.id,
      principle: d.principle,
      month: d.month,
      target_applications: d.targetApplications,
      reflection: d.reflection ?? null,
    }, { onConflict: 'user_id,month' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ principle: mapPrinciple(data as Record<string, unknown>) })
}
