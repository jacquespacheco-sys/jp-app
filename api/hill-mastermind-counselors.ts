import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CounselorSaveSchema, CounselorIdSchema } from './_schemas/hill.js'
import { mapCounselor } from './_hill-mastermind.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('hill_mastermind_counselors')
      .select('*').eq('user_id', user.id)
      .order('display_order', { ascending: true }).order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ counselors: (data ?? []).map(mapCounselor) })
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const parsed = CounselorSaveSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
    }
    const d = parsed.data
    const payload = {
      user_id: user.id,
      name: d.name,
      short_label: d.shortLabel,
      archetype: d.archetype,
      ...(d.isRealPerson !== undefined ? { is_real_person: d.isRealPerson } : {}),
      ...(d.contextPrompt !== undefined ? { context_prompt: d.contextPrompt } : {}),
      ...(d.displayOrder !== undefined ? { display_order: d.displayOrder } : {}),
    }
    if (d.id) {
      const { data, error } = await supabase.from('hill_mastermind_counselors')
        .update(payload).eq('id', d.id).eq('user_id', user.id).select().single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ counselor: mapCounselor(data) })
    }
    const { data, error } = await supabase.from('hill_mastermind_counselors').insert(payload).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ counselor: mapCounselor(data) })
  }

  if (req.method === 'DELETE') {
    const parsed = CounselorIdSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'id obrigatório' })
    const { error } = await supabase.from('hill_mastermind_counselors')
      .delete().eq('id', parsed.data.id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
