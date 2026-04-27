import './_env.js'
import { requireCron } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { generateBriefing } from './_briefing.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 300

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!requireCron(req, res)) return

  const supabase = getSupabase()
  const today = new Date().toISOString().slice(0, 10)

  const { data: users } = await supabase.from('users').select('id, email')

  const results: Array<{ userId: string; status: string; briefingId?: string; error?: string }> = []

  for (const user of (users ?? [])) {
    const { data: existing } = await supabase
      .from('briefings')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    if (existing) {
      results.push({ userId: user.id, status: 'skipped' })
      continue
    }

    try {
      const briefing = await generateBriefing(user.id, user.email, today)
      results.push({ userId: user.id, status: 'generated', briefingId: briefing.id })
    } catch (e) {
      results.push({
        userId: user.id,
        status: 'error',
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return res.status(200).json({ date: today, results })
}
