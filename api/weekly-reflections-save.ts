import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { WeeklyReflectionSaveSchema } from './_schemas/weekly-reflection.js'
import { mapWeeklyReflection } from './weekly-reflections-list.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = WeeklyReflectionSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  const ids = [d.markedMeContactId, d.letDownContactId, d.reconnectContactId].filter((x): x is string => !!x)
  if (ids.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .in('id', ids)
      .eq('user_id', user.id)
    if (!contacts || contacts.length !== new Set(ids).size) {
      return res.status(404).json({ error: 'contato(s) não encontrado(s)' })
    }
  }

  const { data, error } = await supabase
    .from('weekly_reflections')
    .upsert({
      user_id: user.id,
      week: d.week,
      marked_me_contact_id: d.markedMeContactId ?? null,
      marked_me_why: d.markedMeWhy ?? null,
      let_down_contact_id: d.letDownContactId ?? null,
      let_down_why: d.letDownWhy ?? null,
      reconnect_contact_id: d.reconnectContactId ?? null,
      reconnect_handled: d.reconnectHandled,
    }, { onConflict: 'user_id,week' })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ reflection: mapWeeklyReflection(data as Record<string, unknown>) })
}
