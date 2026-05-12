import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapMemory(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    kind: r['kind'],
    content: r['content'],
    source: r['source'] ?? undefined,
    relatedAreaId: r['related_area_id'] ?? undefined,
    relatedProjectId: r['related_project_id'] ?? undefined,
    relatedTaskId: r['related_task_id'] ?? undefined,
    relevance: r['relevance'],
    expiresAt: r['expires_at'] ?? undefined,
    lastReferencedAt: r['last_referenced_at'] ?? undefined,
    createdAt: r['created_at'],
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('coach_memory')
    .select('*')
    .eq('user_id', user.id)
    .or(`expires_at.is.null,expires_at.gte.${now}`)
    .order('relevance', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  const memories = (data ?? []).map(r => mapMemory(r as unknown as Record<string, unknown>))
  return res.status(200).json({ memories })
}
