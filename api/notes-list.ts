import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// New tables (notes, note_tags, note_folders, note_tag_map) are defined in 0008_notes.sql migration.
// database.ts is generated from Supabase and doesn't include them until after `npm run db:types`.
// Using any cast here is intentional — remove after regenerating database.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

function mapNote(r: Record<string, unknown>, tagIds: string[] = []) {
  return {
    id: r['id'] as string,
    userId: r['user_id'] as string,
    ...(r['folder_id'] != null ? { folderId: r['folder_id'] as string } : {}),
    type: r['type'] as string,
    ...(r['title'] != null ? { title: r['title'] as string } : {}),
    content: r['content'] as string,
    ...(r['url'] != null ? { url: r['url'] as string } : {}),
    ...(r['thumbnail_url'] != null ? { thumbnailUrl: r['thumbnail_url'] as string } : {}),
    ...(r['audio_duration'] != null ? { audioDuration: r['audio_duration'] as number } : {}),
    pinned: r['pinned'] as boolean,
    archived: r['archived'] as boolean,
    tagIds,
    createdAt: r['created_at'] as string,
    updatedAt: r['updated_at'] as string,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const { folder, type, tag, search, archived } = req.query
  const showArchived = archived === 'true'
  const supabase = db()

  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', showArchived)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (typeof folder === 'string' && folder) query = query.eq('folder_id', folder)
  if (typeof type === 'string' && type) query = query.eq('type', type)
  if (typeof search === 'string' && search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: (error as { message: string }).message })

  const rows = (data ?? []) as Record<string, unknown>[]

  // Fetch tag mappings for all notes
  const ids = rows.map(r => r['id'] as string)
  const tagMap: Record<string, string[]> = {}
  if (ids.length > 0) {
    const { data: tagData } = await supabase
      .from('note_tag_map')
      .select('note_id, tag_id')
      .in('note_id', ids)
    for (const t of (tagData ?? []) as Record<string, string>[]) {
      const noteId = t['note_id']!
      const tagId = t['tag_id']!
      tagMap[noteId] ??= []
      tagMap[noteId]!.push(tagId)
    }
  }

  // Filter by tag if requested
  let notes = rows.map(r => mapNote(r, tagMap[r['id'] as string] ?? []))
  if (typeof tag === 'string' && tag) {
    notes = notes.filter(n => n.tagIds.includes(tag))
  }

  return res.status(200).json({ notes })
}
