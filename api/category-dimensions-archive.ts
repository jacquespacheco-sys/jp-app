import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { CategoryDimensionArchiveSchema } from './_schemas/category-dimension.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = CategoryDimensionArchiveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('category_dimensions')
    .update({ archived: parsed.data.archived })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(204).end()
}
