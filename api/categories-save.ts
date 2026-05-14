import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CategorySaveSchema } from './_schemas/category.js'
import { mapCategory } from './categories-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CategorySaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  const { data: dim } = await supabase
    .from('category_dimensions')
    .select('id')
    .eq('id', d.dimensionId)
    .eq('user_id', user.id)
    .single()
  if (!dim) return res.status(404).json({ error: 'dimensão não encontrada' })

  const payload = {
    user_id: user.id,
    dimension_id: d.dimensionId,
    label: d.label,
    slug: d.slug,
    color: d.color ?? null,
    description: d.description ?? null,
    sort_order: d.sortOrder,
  }

  let row: Record<string, unknown>
  if (d.id) {
    const { data, error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select('*, category_dimensions:dimension_id(label, slug)')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  } else {
    const { data, error } = await supabase
      .from('categories')
      .insert(payload)
      .select('*, category_dimensions:dimension_id(label, slug)')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
  }

  return res.status(d.id ? 200 : 201).json({ category: mapCategory(row) })
}
