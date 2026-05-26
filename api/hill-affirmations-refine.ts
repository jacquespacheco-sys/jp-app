import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { AffirmationRefineSchema } from './_schemas/hill.js'
import { mapAffirmation } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Refina uma afirmação ativa: aposenta a antiga (superseded) e cria a nova versão.
// Legítimo só na revisão trimestral (D3) — o front só expõe isso lá.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = AffirmationRefineSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()
  const today = new Date().toISOString().slice(0, 10)

  // 1) aposenta a ativa (libera o índice único parcial); confirma posse + estado
  const { data: old, error: oldErr } = await supabase
    .from('hill_affirmations')
    .update({ status: 'superseded', active_until: today })
    .eq('id', d.id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .select('dimension, chief_aim_id')
    .maybeSingle()
  if (oldErr) return res.status(500).json({ error: oldErr.message })
  if (!old) return res.status(409).json({ error: 'afirmação não está ativa' })

  // 2) cria a nova versão ativa
  const { data: created, error: insErr } = await supabase
    .from('hill_affirmations')
    .insert({
      user_id: user.id,
      chief_aim_id: old.chief_aim_id,
      dimension: old.dimension,
      text: d.text,
      belief_score: d.beliefScore,
    })
    .select()
    .single()
  if (insErr) return res.status(500).json({ error: insErr.message })

  // 3) liga a antiga à nova
  await supabase.from('hill_affirmations').update({ superseded_by: created.id }).eq('id', d.id).then(null, () => {})

  return res.status(201).json({ affirmation: mapAffirmation(created) })
}
