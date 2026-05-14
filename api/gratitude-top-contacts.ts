import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const days = Math.min(365, Math.max(7, parseInt(String(req.query['days'] ?? '90'), 10) || 90))
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString()

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('gratitude_entries')
    .select('contact_id')
    .eq('user_id', user.id)
    .not('contact_id', 'is', null)
    .gte('created_at', sinceIso)

  if (error) return res.status(500).json({ error: error.message })

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const id = (row as { contact_id: string | null }).contact_id
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  if (topIds.length === 0) {
    return res.status(200).json({ topContacts: [] })
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, tier, last_interaction_at')
    .in('id', topIds)
    .eq('user_id', user.id)

  const byId = new Map((contacts ?? []).map(c => [(c as { id: string }).id, c as Record<string, unknown>]))
  const topContacts = topIds.map(id => {
    const c = byId.get(id)
    if (!c) return null
    return {
      contactId: id,
      firstName: c['first_name'] as string,
      lastName: (c['last_name'] ?? null) as string | null,
      tier: (c['tier'] ?? null) as string | null,
      lastInteractionAt: (c['last_interaction_at'] ?? null) as string | null,
      mentions: counts.get(id) ?? 0,
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  return res.status(200).json({ topContacts })
}
