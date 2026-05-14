import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Category, CategoryColor } from '../src/types/domain.ts'

type Family = { spouse?: string; children?: string[]; pets?: string[] } & Record<string, unknown>
type LastSignal = { type?: string; text?: string; url?: string; date?: string } & Record<string, unknown>

interface ContactRow {
  id: string
  user_id: string
  first_name: string
  last_name: string | null
  company: string | null
  role: string | null
  email: string | null
  phone: string | null
  address: string | null
  birthday: string | null
  tags: string[] | null
  phase: string | null
  next_contact: string | null
  notes: string | null
  google_contact_id: string | null
  synced: boolean
  archived: boolean
  archived_at: string | null
  created_at: string
  updated_at: string

  tier: string | null
  cadence_days: number | null
  last_interaction_at: string | null
  preferred_name: string | null
  pronunciation: string | null
  interests: string[] | null
  conversation_hooks: string[] | null
  what_they_value: string | null
  their_goals: string | null
  family: Family | null
  first_met_at: string | null
  company_start_date: string | null
  preferred_channel: string | null
  favor_balance: number | null
  linkedin_url: string | null
  twitter_handle: string | null
  instagram_handle: string | null
  last_signal: LastSignal | null
  last_signal_at: string | null
  source_contact_id: string | null
  source_context: string | null

  categories?: Array<{
    id: string; label: string; slug: string
    color: string | null
    dimensionId: string; dimensionLabel: string; dimensionSlug: string
  }> | null
}

function mapCategoryAgg(raw: Record<string, unknown>): Category {
  const r = raw as {
    id: string; label: string; slug: string
    color: string | null
    dimensionId: string; dimensionLabel: string; dimensionSlug: string
  }
  return {
    id: r.id,
    dimensionId: r.dimensionId,
    dimensionLabel: r.dimensionLabel,
    dimensionSlug: r.dimensionSlug,
    label: r.label,
    slug: r.slug,
    sortOrder: 0,
    archived: false,
    usageCount: 0,
    ...(r.color != null ? { color: r.color as CategoryColor } : {}),
  }
}

function mapContact(raw: Record<string, unknown>) {
  const r = raw as Partial<ContactRow>
  return {
    id: r.id as string,
    userId: r.user_id as string,
    firstName: r.first_name as string,
    tags: (r.tags ?? []) as string[],
    notes: (r.notes ?? '') as string,
    synced: !!r.synced,
    archived: !!r.archived,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    ...(r.last_name != null ? { lastName: r.last_name } : {}),
    ...(r.company != null ? { company: r.company } : {}),
    ...(r.role != null ? { role: r.role } : {}),
    ...(r.email != null ? { email: r.email } : {}),
    ...(r.phone != null ? { phone: r.phone } : {}),
    ...(r.address != null ? { address: r.address } : {}),
    ...(r.birthday != null ? { birthday: r.birthday } : {}),
    ...(r.phase != null ? { phase: r.phase } : {}),
    ...(r.next_contact != null ? { nextContact: r.next_contact } : {}),
    ...(r.google_contact_id != null ? { googleContactId: r.google_contact_id } : {}),
    ...(r.archived_at != null ? { archivedAt: r.archived_at } : {}),

    ...(r.tier != null ? { tier: r.tier } : {}),
    ...(r.cadence_days != null ? { cadenceDays: r.cadence_days } : {}),
    ...(r.last_interaction_at != null ? { lastInteractionAt: r.last_interaction_at } : {}),
    ...(r.preferred_name != null ? { preferredName: r.preferred_name } : {}),
    ...(r.pronunciation != null ? { pronunciation: r.pronunciation } : {}),
    ...(r.interests != null ? { interests: r.interests } : { interests: [] }),
    ...(r.conversation_hooks != null ? { conversationHooks: r.conversation_hooks } : { conversationHooks: [] }),
    ...(r.what_they_value != null ? { whatTheyValue: r.what_they_value } : {}),
    ...(r.their_goals != null ? { theirGoals: r.their_goals } : {}),
    ...(r.family != null ? { family: r.family } : {}),
    ...(r.first_met_at != null ? { firstMetAt: r.first_met_at } : {}),
    ...(r.company_start_date != null ? { companyStartDate: r.company_start_date } : {}),
    ...(r.preferred_channel != null ? { preferredChannel: r.preferred_channel } : {}),
    ...(r.favor_balance != null ? { favorBalance: r.favor_balance } : { favorBalance: 0 }),
    ...(r.linkedin_url != null ? { linkedinUrl: r.linkedin_url } : {}),
    ...(r.twitter_handle != null ? { twitterHandle: r.twitter_handle } : {}),
    ...(r.instagram_handle != null ? { instagramHandle: r.instagram_handle } : {}),
    ...(r.last_signal != null ? { lastSignal: r.last_signal } : {}),
    ...(r.last_signal_at != null ? { lastSignalAt: r.last_signal_at } : {}),
    ...(r.source_contact_id != null ? { sourceContactId: r.source_contact_id } : {}),
    ...(r.source_context != null ? { sourceContext: r.source_context } : {}),
    ...(Array.isArray(r.categories) ? {
      categories: r.categories.map(c => mapCategoryAgg(c as Record<string, unknown>)),
    } : {}),
  }
}

export { mapContact }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const categoryIdsParam = typeof req.query['categoryIds'] === 'string' ? req.query['categoryIds'] : null
  const categoryIds = categoryIdsParam
    ? categoryIdsParam.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const supabase = getSupabase()
  const [{ data, error }, { data: userData }] = await Promise.all([
    supabase
      .from('v_contacts_with_categories')
      .select('*')
      .eq('user_id', user.id)
      .order('first_name', { ascending: true }),
    supabase
      .from('users')
      .select('google_refresh_token')
      .eq('id', user.id)
      .single(),
  ])

  if (error) return res.status(500).json({ error: error.message })

  let rows = (data ?? []) as Record<string, unknown>[]

  if (categoryIds.length > 0) {
    const { data: catLookup } = await supabase
      .from('categories')
      .select('id, dimension_id')
      .in('id', categoryIds)
      .eq('user_id', user.id)
    const byDimension = new Map<string, Set<string>>()
    for (const r of (catLookup ?? []) as { id: string; dimension_id: string }[]) {
      const s = byDimension.get(r.dimension_id) ?? new Set<string>()
      s.add(r.id)
      byDimension.set(r.dimension_id, s)
    }
    const dimGroups = [...byDimension.values()]
    rows = rows.filter(row => {
      const cats = (row['categories'] ?? []) as Array<{ id: string }>
      const ids = new Set(cats.map(c => c.id))
      return dimGroups.every(group => [...group].some(id => ids.has(id)))
    })
  }

  return res.status(200).json({
    googleConnected: !!userData?.google_refresh_token,
    contacts: rows.map(c => mapContact(c)),
  })
}
