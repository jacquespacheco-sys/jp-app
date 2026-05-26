import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { AffirmationWizardSchema } from './_schemas/hill.js'
import { mapAffirmation } from './_hill.js'
import type { Database } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type AffirmationInsert = Database['public']['Tables']['hill_affirmations']['Insert']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = AffirmationWizardSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const { chiefAimId, affirmations } = parsed.data
  const supabase = getSupabase()

  const { data: aim, error: aimErr } = await supabase
    .from('hill_chief_aims')
    .select('id')
    .eq('id', chiefAimId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (aimErr) return res.status(500).json({ error: aimErr.message })
  if (!aim) return res.status(400).json({ error: 'chief aim inválido' })

  const dims = affirmations.map((a) => a.dimension)
  const today = new Date().toISOString().slice(0, 10)

  // Aposenta as ativas das dimensões enviadas (libera o índice único parcial)
  const { error: retireErr } = await supabase
    .from('hill_affirmations')
    .update({ status: 'retired', active_until: today, retired_reason: 'substituída no wizard' })
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('dimension', dims)
  if (retireErr) return res.status(500).json({ error: retireErr.message })

  const rows: AffirmationInsert[] = affirmations.map((a) => ({
    user_id: user.id,
    chief_aim_id: chiefAimId,
    dimension: a.dimension,
    text: a.text,
    belief_score: a.beliefScore,
    ...(a.derivedFrom != null ? { derived_from: a.derivedFrom } : {}),
  }))

  const { data, error } = await supabase.from('hill_affirmations').insert(rows).select()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({ affirmations: (data ?? []).map(mapAffirmation) })
}
