import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { InboxCaptureSchema } from './_schemas/inbox.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = InboxCaptureSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { rawText, source, externalRef } = parsed.data
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('inbox_items')
    .insert({
      user_id: user.id,
      raw_text: rawText,
      source,
      external_ref: externalRef ?? null,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    item: {
      id: data.id,
      userId: data.user_id,
      rawText: data.raw_text,
      source: data.source,
      externalRef: data.external_ref ?? undefined,
      aiSuggestion: data.ai_suggestion ?? undefined,
      processed: data.processed,
      createdAt: data.created_at,
    },
  })
}
