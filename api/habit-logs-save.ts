import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { HabitLogSaveSchema } from './_schemas/habit.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapLog(r: Record<string, unknown>) {
  return {
    id: r['id'],
    habitId: r['habit_id'],
    userId: r['user_id'],
    doneOn: r['done_on'],
    doneAt: r['done_at'],
    dose: r['dose'],
    note: r['note'] ?? undefined,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = HabitLogSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  // Verifica que o hábito pertence ao user
  const { data: habit, error: hErr } = await supabase
    .from('habits').select('id').eq('id', d.habitId).eq('user_id', user.id).single()
  if (hErr || !habit) return res.status(404).json({ error: 'hábito não encontrado' })

  // Upsert (unique constraint habit_id + done_on)
  const { data, error } = await supabase
    .from('habit_logs')
    .upsert({
      habit_id: d.habitId,
      user_id: user.id,
      done_on: d.doneOn,
      done_at: new Date().toISOString(),
      dose: d.dose,
      note: d.note ?? null,
    }, { onConflict: 'habit_id,done_on' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ log: mapLog(data as unknown as Record<string, unknown>) })
}
