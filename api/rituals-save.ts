import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { RitualSaveSchema } from './_schemas/habit.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRitual(r: Record<string, unknown>, steps: Record<string, unknown>[]) {
  return {
    id: r['id'],
    userId: r['user_id'],
    name: r['name'],
    triggerTime: r['trigger_time'] ?? undefined,
    description: r['description'] ?? undefined,
    active: r['active'],
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
    steps: steps
      .sort((a, b) => (a['position'] as number) - (b['position'] as number))
      .map(s => ({
        id: s['id'],
        position: s['position'],
        habitId: s['habit_id'] ?? undefined,
        customStep: s['custom_step'] ?? undefined,
        estimatedMin: s['estimated_min'] ?? undefined,
      })),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = RitualSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const ritualPayload = {
    user_id: user.id,
    name: d.name,
    trigger_time: d.triggerTime ?? null,
    description: d.description ?? null,
    active: d.active,
    updated_at: now,
  }

  let ritualId: string
  let httpStatus: number

  if (d.id) {
    const { data, error } = await supabase
      .from('rituals').update(ritualPayload)
      .eq('id', d.id).eq('user_id', user.id)
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    ritualId = data.id
    httpStatus = 200

    // Replace steps: deletar e re-inserir (simples)
    await supabase.from('ritual_steps').delete().eq('ritual_id', ritualId)
  } else {
    const { data, error } = await supabase
      .from('rituals').insert(ritualPayload)
      .select().single()
    if (error) return res.status(500).json({ error: error.message })
    ritualId = data.id
    httpStatus = 201
  }

  let stepsResult: Record<string, unknown>[] = []
  if (d.steps.length > 0) {
    const stepsPayload = d.steps.map(s => ({
      ritual_id: ritualId,
      position: s.position,
      habit_id: s.habitId ?? null,
      custom_step: s.customStep ?? null,
      estimated_min: s.estimatedMin ?? null,
    }))
    const { data: insertedSteps, error: stepsErr } = await supabase
      .from('ritual_steps').insert(stepsPayload).select()
    if (stepsErr) return res.status(500).json({ error: stepsErr.message })
    stepsResult = (insertedSteps ?? []) as unknown as Record<string, unknown>[]
  }

  // Reload ritual completo pra retornar consistente
  const { data: ritualRow, error: reloadErr } = await supabase
    .from('rituals').select('*').eq('id', ritualId).single()
  if (reloadErr || !ritualRow) return res.status(500).json({ error: reloadErr?.message ?? 'reload falhou' })

  return res.status(httpStatus).json({
    ritual: mapRitual(ritualRow as unknown as Record<string, unknown>, stepsResult),
  })
}
