import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { AreaSaveSchema } from './_schemas/area.js'
import type { Database } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type AreaRow = Database['public']['Tables']['areas']['Row']

function rowToArea(a: AreaRow) {
  return {
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
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = AreaSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { id, parentId, name, slug, quadrant, visionH4, color, icon, position } = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload: Database['public']['Tables']['areas']['Insert'] = {
    user_id: user.id,
    name,
    slug,
    quadrant,
    parent_id: parentId ?? null,
    vision_h4: visionH4 ?? null,
    color: color ?? null,
    icon: icon ?? null,
    position: position ?? 0,
    updated_at: now,
  }

  if (id) {
    const { data, error } = await supabase
      .from('areas')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ area: rowToArea(data) })
  }

  const { data, error } = await supabase
    .from('areas')
    .insert(payload)
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ area: rowToArea(data) })
}
