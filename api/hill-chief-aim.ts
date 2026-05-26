import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ChiefAimCreateSchema, ChiefAimPatchSchema } from './_schemas/hill.js'
import { mapChiefAim } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  // GET → o Chief Aim ativo (ou null)
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('hill_chief_aims')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ chiefAim: data ? mapChiefAim(data) : null })
  }

  // POST → cria novo; arquiva o anterior (libera o índice único parcial)
  if (req.method === 'POST') {
    const parsed = ChiefAimCreateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
    }
    const d = parsed.data
    const now = new Date().toISOString()

    const { error: archiveErr } = await supabase
      .from('hill_chief_aims')
      .update({ is_active: false, archived_at: now, updated_at: now })
      .eq('user_id', user.id)
      .eq('is_active', true)
    if (archiveErr) return res.status(500).json({ error: archiveErr.message })

    const payload = {
      user_id: user.id,
      aim_text: d.aimText,
      deadline: d.deadline,
      exchange_text: d.exchangeText,
      plan_text: d.planText ?? null,
      ...(d.nextReview != null ? { next_review: d.nextReview } : {}),
    }
    const { data, error } = await supabase
      .from('hill_chief_aims')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ chiefAim: mapChiefAim(data) })
  }

  // PATCH → só meta (plan_text, exchange_text); aim_text e deadline são imutáveis
  if (req.method === 'PATCH') {
    const parsed = ChiefAimPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
    }
    const d = parsed.data
    const patch = {
      ...(d.planText !== undefined ? { plan_text: d.planText } : {}),
      ...(d.exchangeText !== undefined ? { exchange_text: d.exchangeText } : {}),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('hill_chief_aims')
      .update(patch)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ chiefAim: mapChiefAim(data) })
  }

  return res.status(405).end()
}
