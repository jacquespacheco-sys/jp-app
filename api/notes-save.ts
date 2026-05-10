import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { NoteSaveSchema } from './_schemas/note.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// New tables not in generated database.ts yet — see 0008_notes.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = NoteSaveSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })

  const { id, folderId, type, title, content, url, thumbnailUrl, audioDuration, pinned, archived, tagIds } = parsed.data
  const supabase = db()
  const now = new Date().toISOString()

  const payload = {
    type, content, updated_at: now,
    folder_id: folderId ?? null,
    title: title ?? null,
    url: url ?? null,
    thumbnail_url: thumbnailUrl ?? null,
    audio_duration: audioDuration ?? null,
    ...(pinned !== undefined && { pinned }),
    ...(archived !== undefined && { archived }),
  }

  let noteId: string
  let httpStatus: number

  if (id) {
    const { error } = await supabase.from('notes').update(payload).eq('id', id).eq('user_id', user.id)
    if (error) return res.status(500).json({ error: (error as { message: string }).message })
    noteId = id
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('notes')
      .insert({ ...payload, user_id: user.id })
      .select('id')
      .single()
    if (error || !data) return res.status(500).json({ error: (error as { message: string } | null)?.message ?? 'insert failed' })
    noteId = (data as Record<string, string>)['id']!
    httpStatus = 201
  }

  if (tagIds !== undefined) {
    await supabase.from('note_tag_map').delete().eq('note_id', noteId)
    if (tagIds.length > 0) {
      await supabase.from('note_tag_map').insert(tagIds.map((tagId: string) => ({ note_id: noteId, tag_id: tagId })))
    }
  }

  const { data: noteData } = await supabase.from('notes').select('*').eq('id', noteId).single()
  const { data: tagData } = await supabase.from('note_tag_map').select('tag_id').eq('note_id', noteId)
  const finalTagIds = ((tagData ?? []) as Record<string, string>[]).map(t => t['tag_id']!)

  const row = noteData as Record<string, unknown>
  const note = {
    id: row['id'], userId: row['user_id'], type: row['type'],
    content: row['content'], pinned: row['pinned'], archived: row['archived'],
    tagIds: finalTagIds, createdAt: row['created_at'], updatedAt: row['updated_at'],
    ...(row['folder_id'] != null ? { folderId: row['folder_id'] } : {}),
    ...(row['title'] != null ? { title: row['title'] } : {}),
    ...(row['url'] != null ? { url: row['url'] } : {}),
    ...(row['thumbnail_url'] != null ? { thumbnailUrl: row['thumbnail_url'] } : {}),
    ...(row['audio_duration'] != null ? { audioDuration: row['audio_duration'] } : {}),
  }
  return res.status(httpStatus).json({ note })
}
