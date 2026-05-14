import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface PrincipleRow {
  id: string
  user_id: string
  principle: string
  month: string
  target_applications: number
  reflection: string | null
  created_at: string
  updated_at: string
}

export function mapPrinciple(raw: Record<string, unknown>) {
  const r = raw as Partial<PrincipleRow>
  return {
    id: r.id as string,
    userId: r.user_id as string,
    principle: r.principle as string,
    month: r.month as string,
    targetApplications: (r.target_applications ?? 12) as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    ...(r.reflection != null ? { reflection: r.reflection } : {}),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('principle_of_month')
    .select('*')
    .eq('user_id', user.id)
    .order('month', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    principles: (data ?? []).map(r => mapPrinciple(r as Record<string, unknown>)),
  })
}
