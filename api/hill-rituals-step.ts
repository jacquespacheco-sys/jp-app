import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { RitualStepSchema } from './_schemas/hill.js'
import { mapRitualLog } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function uniqPush(arr: string[], value: string | undefined): string[] {
  if (!value || arr.includes(value)) return arr
  return [...arr, value]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = RitualStepSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()

  const { data: row, error: rowErr } = await supabase
    .from('hill_ritual_logs')
    .select('steps_completed, affirmations_read, affirmations_skipped')
    .eq('id', d.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (rowErr) return res.status(500).json({ error: rowErr.message })
  if (!row) return res.status(404).json({ error: 'ritual não encontrado' })

  const steps = uniqPush((row.steps_completed as unknown as string[]) ?? [], d.step)
  const read = uniqPush(row.affirmations_read ?? [], d.affirmationRead)
  const skipped = uniqPush(row.affirmations_skipped ?? [], d.affirmationSkipped)

  const { data, error } = await supabase
    .from('hill_ritual_logs')
    .update({ steps_completed: steps, affirmations_read: read, affirmations_skipped: skipped })
    .eq('id', d.id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ritual: mapRitualLog(data) })
}
