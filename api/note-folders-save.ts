import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { NoteFolderSaveSchema } from './_schemas/note.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// New tables not in generated database.ts yet — see 0008_notes.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const parsed = NoteFolderSaveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'inválido' })
  const { id, parentId, name } = parsed.data
  const supabase = db()
  const now = new Date().toISOString()
  if (id) {
    const { error } = await supabase.from('note_folders')
      .update({ name, parent_id: parentId ?? null, updated_at: now })
      .eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: (error as { message: string }).message })
    return res.status(200).json({ ok: true })
  }
  const { data, error } = await supabase.from('note_folders')
    .insert({ user_id: user.id, name, parent_id: parentId ?? null, updated_at: now })
    .select('*').single()
  if (error) return res.status(500).json({ error: (error as { message: string }).message })
  const f = data as Record<string, unknown>
  return res.status(201).json({ folder: {
    id: f['id'], userId: f['user_id'], name: f['name'], createdAt: f['created_at'], updatedAt: f['updated_at'],
    ...(f['parent_id'] != null ? { parentId: f['parent_id'] } : {}),
  }})
}
