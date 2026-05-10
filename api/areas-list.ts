import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('user_id', user.id)
    .is('archived_at', null)
    .order('position', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    areas: (data ?? []).map(a => ({
      id: a.id,
      userId: a.user_id,
      parentId: a.parent_id ?? undefined,
      name: a.name,
      slug: a.slug,
      quadrant: a.quadrant,
      visionH4: a.vision_h4 ?? undefined,
      color: a.color ?? undefined,
      icon: a.icon ?? undefined,
      position: a.position,
      archivedAt: a.archived_at ?? undefined,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    })),
  })
}
