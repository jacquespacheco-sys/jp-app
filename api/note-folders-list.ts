import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// New tables not in generated database.ts yet — see 0008_notes.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const { data, error } = await db()
    .from('note_folders').select('*').eq('user_id', user.id).order('name')
  if (error) return res.status(500).json({ error: (error as { message: string }).message })
  const folders = ((data ?? []) as Record<string, unknown>[]).map(f => ({
    id: f['id'], userId: f['user_id'],
    ...(f['parent_id'] != null ? { parentId: f['parent_id'] } : {}),
    name: f['name'], createdAt: f['created_at'], updatedAt: f['updated_at'],
  }))
  return res.status(200).json({ folders })
}
