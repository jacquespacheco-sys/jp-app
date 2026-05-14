import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ContactRow {
  id: string
  first_name: string
  last_name: string | null
  company: string | null
  role: string | null
  tier: string | null
  phase: string | null
  tags: string[] | null
  last_interaction_at: string | null
  conversation_hooks: string[] | null
  notes: string | null
  preferred_channel: string | null
}

interface InteractionRow {
  contact_id: string
}

const TIER_KEYS = ['inner', 'strong', 'network', 'weak', 'dormant'] as const

const FAMILY_TAGS = new Set([
  'família', 'familia', 'family', 'esposa', 'marido', 'irmão', 'irmao', 'irmã', 'irma',
  'mãe', 'mae', 'pai', 'filho', 'filha',
])
const PARTNER_TAGS = new Set(['sócio', 'socio', 'partner', 'cofounder'])

function suggestTier(c: ContactRow, interactionCount: number, lastInteractionDaysAgo: number | null): string | null {
  const tagsLower = (c.tags ?? []).map(t => t.toLowerCase())
  if (tagsLower.some(t => FAMILY_TAGS.has(t)) || tagsLower.some(t => PARTNER_TAGS.has(t))) {
    return 'inner'
  }
  if (c.phase === 'active' && lastInteractionDaysAgo != null && lastInteractionDaysAgo <= 30) {
    return 'strong'
  }
  if (c.phase === 'dormant' || (lastInteractionDaysAgo != null && lastInteractionDaysAgo > 180)) {
    return 'dormant'
  }
  if (interactionCount >= 3 && lastInteractionDaysAgo != null && lastInteractionDaysAgo <= 90) {
    return 'network'
  }
  return null
}

function priorityScore(c: ContactRow): number {
  const hooks = c.conversation_hooks ?? []
  if (c.tier == null) return 0
  if ((c.tier === 'inner' || c.tier === 'strong') && hooks.length === 0) return 1
  if ((c.tier === 'inner' || c.tier === 'strong') && hooks.length < 3) return 2
  return 99
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const limit = Math.min(200, Math.max(10, parseInt(String(req.query['limit'] ?? '50'), 10) || 50))
  const supabase = getSupabase()
  const oneYearAgoIso = new Date(Date.now() - 365 * 86400000).toISOString()

  const [contactsRes, interactionsRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name, company, role, tier, phase, tags, last_interaction_at, conversation_hooks, notes, preferred_channel')
      .eq('user_id', user.id)
      .eq('archived', false),
    supabase
      .from('interactions')
      .select('contact_id')
      .gte('date', oneYearAgoIso),
  ])

  if (contactsRes.error) return res.status(500).json({ error: contactsRes.error.message })

  const contacts = (contactsRes.data ?? []) as ContactRow[]
  const interactionMap = new Map<string, number>()
  for (const i of (interactionsRes.data ?? []) as InteractionRow[]) {
    interactionMap.set(i.contact_id, (interactionMap.get(i.contact_id) ?? 0) + 1)
  }

  const now = Date.now()
  const enriched = contacts.map(c => {
    const lastDays = c.last_interaction_at != null
      ? Math.floor((now - new Date(c.last_interaction_at).getTime()) / 86400000)
      : null
    const interactionCount = interactionMap.get(c.id) ?? 0
    const score = priorityScore(c)
    return {
      raw: c,
      score,
      interactionCount,
      lastDays,
    }
  })

  const counts: Record<string, number> = { inner: 0, strong: 0, network: 0, weak: 0, dormant: 0 }
  for (const c of contacts) {
    if (c.tier && TIER_KEYS.includes(c.tier as typeof TIER_KEYS[number])) counts[c.tier]! += 1
  }

  const totalRemaining = enriched.filter(e => e.score < 99).length

  const queue = enriched
    .filter(e => e.score < 99)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      return b.interactionCount - a.interactionCount
    })
    .slice(0, limit)
    .map(e => ({
      id: e.raw.id,
      firstName: e.raw.first_name,
      lastName: e.raw.last_name,
      company: e.raw.company,
      role: e.raw.role,
      tier: e.raw.tier,
      phase: e.raw.phase,
      tags: e.raw.tags ?? [],
      lastInteractionAt: e.raw.last_interaction_at,
      interactionCount: e.interactionCount,
      conversationHooks: e.raw.conversation_hooks ?? [],
      preferredChannel: e.raw.preferred_channel,
      suggestedTier: suggestTier(e.raw, e.interactionCount, e.lastDays),
    }))

  return res.status(200).json({
    items: queue,
    totalRemaining,
    currentCounts: counts,
  })
}
