import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { NoteUploadSchema } from './_schemas/note.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const parsed = NoteUploadSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'dados inválidos' })
  const { noteId, base64, contentType } = parsed.data
  const buffer = Buffer.from(base64, 'base64')
  const path = `${user.id}/${noteId}.webm`
  const supabase = getSupabase()
  const { error } = await supabase.storage.from('note-audio').upload(path, buffer, {
    contentType, upsert: true,
  })
  if (error) return res.status(500).json({ error: error.message })
  const { data: urlData } = supabase.storage.from('note-audio').getPublicUrl(path)
  return res.status(200).json({ url: urlData.publicUrl })
}
