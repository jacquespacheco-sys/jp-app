import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { OnboardingBulkClassifySchema } from './_schemas/onboarding.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = OnboardingBulkClassifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const supabase = getSupabase()
  const ids = parsed.data.updates.map(u => u.id)

  const { data: owned } = await supabase
    .from('contacts')
    .select('id, conversation_hooks')
    .in('id', ids)
    .eq('user_id', user.id)

  if (!owned || owned.length !== new Set(ids).size) {
    return res.status(404).json({ error: 'contato(s) não encontrado(s)' })
  }
  const ownedMap = new Map(owned.map(c => [(c as { id: string }).id, c as { id: string; conversation_hooks: string[] | null }]))

  let allCategoryIds: string[] = []
  for (const u of parsed.data.updates) {
    if (u.categoryIds && u.categoryIds.length > 0) allCategoryIds = allCategoryIds.concat(u.categoryIds)
  }
  if (allCategoryIds.length > 0) {
    const uniqueCatIds = [...new Set(allCategoryIds)]
    const { data: cats } = await supabase
      .from('categories')
      .select('id')
      .in('id', uniqueCatIds)
      .eq('user_id', user.id)
    if (!cats || cats.length !== uniqueCatIds.length) {
      return res.status(400).json({ error: 'categoria(s) não encontrada(s)' })
    }
  }

  let updatedCount = 0
  for (const u of parsed.data.updates) {
    const existing = ownedMap.get(u.id)
    if (!existing) continue

    const updatePayload: Record<string, unknown> = {}
    if (u.tier) updatePayload['tier'] = u.tier
    if (u.preferredChannel) updatePayload['preferred_channel'] = u.preferredChannel
    if (u.linkedinUrl) updatePayload['linkedin_url'] = u.linkedinUrl
    if (u.cadenceDays != null) updatePayload['cadence_days'] = u.cadenceDays
    if (u.addHook) {
      const current = existing.conversation_hooks ?? []
      if (!current.includes(u.addHook)) {
        updatePayload['conversation_hooks'] = [...current, u.addHook]
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from('contacts')
        .update(updatePayload as never)
        .eq('id', u.id)
        .eq('user_id', user.id)
      if (error) {
        console.error('[bulk-classify] update failed for', u.id, error.message)
        continue
      }
    }

    if (u.categoryIds) {
      const { error: delErr } = await supabase
        .from('contact_categories')
        .delete()
        .eq('contact_id', u.id)
        .eq('user_id', user.id)
      if (!delErr && u.categoryIds.length > 0) {
        const rows = u.categoryIds.map(category_id => ({
          user_id: user.id, contact_id: u.id, category_id,
        }))
        await supabase.from('contact_categories').insert(rows)
      }
    }

    updatedCount++
  }

  return res.status(200).json({ updated: updatedCount })
}
