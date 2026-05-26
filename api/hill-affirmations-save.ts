import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { AffirmationSaveSchema } from './_schemas/hill.js'
import { mapAffirmation } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Cria uma afirmação ativa numa dimensão livre. Mudar uma afirmação já ativa
// (refinar/retirar) é decisão da revisão trimestral (D3) — fora do escopo Fase 1.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = AffirmationSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const d = parsed.data
  const supabase = getSupabase()

  const { data: aim, error: aimErr } = await supabase
    .from('hill_chief_aims')
    .select('id')
    .eq('id', d.chiefAimId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (aimErr) return res.status(500).json({ error: aimErr.message })
  if (!aim) return res.status(400).json({ error: 'chief aim inválido' })

  const { data: existing, error: existingErr } = await supabase
    .from('hill_affirmations')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('dimension', d.dimension)
    .maybeSingle()
  if (existingErr) return res.status(500).json({ error: existingErr.message })
  if (existing) {
    return res.status(409).json({ error: 'já existe afirmação ativa nessa dimensão — use o wizard ou a revisão trimestral' })
  }

  const payload = {
    user_id: user.id,
    chief_aim_id: d.chiefAimId,
    dimension: d.dimension,
    text: d.text,
    belief_score: d.beliefScore,
    ...(d.derivedFrom != null ? { derived_from: d.derivedFrom } : {}),
  }
  const { data, error } = await supabase.from('hill_affirmations').insert(payload).select().single()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({ affirmation: mapAffirmation(data) })
}
