import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { NoteTagSaveSchema } from './_schemas/note.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// New tables not in generated database.ts yet — see 0008_notes.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const parsed = NoteTagSaveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'inválido' })
  const { id, name, color } = parsed.data
  const supabase = db()
  if (id) {
    const { error } = await supabase.from('note_tags').update({ name, color }).eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: (error as { message: string }).message })
    return res.status(200).json({ ok: true })
  }
  const { data, error } = await supabase
    .from('note_tags').insert({ user_id: user.id, name, color }).select('*').single()
  if (error) return res.status(500).json({ error: (error as { message: string }).message })
  const t = data as Record<string, unknown>
  return res.status(201).json({ tag: { id: t['id'], userId: t['user_id'], name: t['name'], color: t['color'], createdAt: t['created_at'] } })
}
