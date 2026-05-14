import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface DimensionRow {
  id: string; user_id: string; label: string; slug: string
  description: string | null; sort_order: number; archived: boolean
  created_at: string; updated_at: string
}

export function mapDimension(raw: Record<string, unknown>) {
  const r = raw as Partial<DimensionRow>
  return {
    id: r.id as string,
    label: r.label as string,
    slug: r.slug as string,
    sortOrder: (r.sort_order ?? 0) as number,
    archived: !!r.archived,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    ...(r.description != null ? { description: r.description } : {}),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const includeArchived = req.query['includeArchived'] === 'true'
  const supabase = getSupabase()
  let q = supabase.from('category_dimensions').select('*').eq('user_id', user.id)
  if (!includeArchived) q = q.eq('archived', false)

  const { data, error } = await q.order('sort_order', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    dimensions: (data ?? []).map(d => mapDimension(d as Record<string, unknown>)),
  })
}
