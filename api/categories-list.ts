import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { CategoryColor } from '../src/types/domain.ts'

interface CategoryRow {
  id: string; user_id: string; dimension_id: string
  label: string; slug: string
  color: string | null; description: string | null
  sort_order: number; archived: boolean
  usage_count: number
  category_dimensions?: { label: string; slug: string } | { label: string; slug: string }[] | null
}

export function mapCategory(raw: Record<string, unknown>) {
  const r = raw as Partial<CategoryRow>
  const dim = Array.isArray(r.category_dimensions) ? r.category_dimensions[0] : r.category_dimensions
  return {
    id: r.id as string,
    dimensionId: r.dimension_id as string,
    label: r.label as string,
    slug: r.slug as string,
    sortOrder: (r.sort_order ?? 0) as number,
    archived: !!r.archived,
    usageCount: (r.usage_count ?? 0) as number,
    ...(r.color != null ? { color: r.color as CategoryColor } : {}),
    ...(r.description != null ? { description: r.description } : {}),
    ...(dim ? { dimensionLabel: dim.label, dimensionSlug: dim.slug } : {}),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const includeArchived = req.query['includeArchived'] === 'true'
  const dimensionId = typeof req.query['dimensionId'] === 'string' ? req.query['dimensionId'] : undefined
  const dimensionSlug = typeof req.query['dimensionSlug'] === 'string' ? req.query['dimensionSlug'] : undefined

  const supabase = getSupabase()
  let q = supabase
    .from('categories')
    .select('*, category_dimensions:dimension_id(label, slug)')
    .eq('user_id', user.id)
  if (!includeArchived) q = q.eq('archived', false)
  if (dimensionId) q = q.eq('dimension_id', dimensionId)

  const { data, error } = await q.order('sort_order', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })

  let rows = (data ?? []) as Record<string, unknown>[]
  if (dimensionSlug) {
    rows = rows.filter(r => {
      const dim = (r['category_dimensions'] ?? null) as { slug?: string } | { slug?: string }[] | null
      const d = Array.isArray(dim) ? dim[0] : dim
      return d?.slug === dimensionSlug
    })
  }

  return res.status(200).json({
    categories: rows.map(r => mapCategory(r)),
  })
}
