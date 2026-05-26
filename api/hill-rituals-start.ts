import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { RitualStartSchema } from './_schemas/hill.js'
import { mapRitualLog } from './_hill.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function dayStr(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = RitualStartSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }
  const { type } = parsed.data
  const supabase = getSupabase()

  // Idempotência: se já há um ritual incompleto do mesmo tipo iniciado hoje, retoma
  const { data: recent, error: recentErr } = await supabase
    .from('hill_ritual_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('type', type)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recentErr) return res.status(500).json({ error: recentErr.message })

  if (recent && recent.completed_at == null) {
    const startedDay = dayStr(new Date(recent.started_at), user.timezone)
    if (startedDay === dayStr(new Date(), user.timezone)) {
      return res.status(200).json({ ritual: mapRitualLog(recent), resumed: true })
    }
  }

  const { data, error } = await supabase
    .from('hill_ritual_logs')
    .insert({ user_id: user.id, type })
    .select()
    .single()
  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({ ritual: mapRitualLog(data), resumed: false })
}
