import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CategoryDimensionSaveSchema } from './_schemas/category-dimension.js'
import { mapDimension } from './category-dimensions-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CategoryDimensionSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()
  const payload = {
    user_id: user.id,
    label: d.label,
    slug: d.slug,
    description: d.description ?? null,
    sort_order: d.sortOrder,
  }

  let row: Record<string, unknown>
  if (d.id) {
    const { data, error } = await supabase
      .from('category_dimensions')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  } else {
    const { data, error } = await supabase
      .from('category_dimensions')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  }

  return res.status(d.id ? 200 : 201).json({ dimension: mapDimension(row) })
}
