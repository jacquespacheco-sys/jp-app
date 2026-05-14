import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface SpecialDateRow {
  id: string
  user_id: string
  contact_id: string
  label: string
  type: string
  date_anniversary: string | null
  date_full: string | null
  recurring: boolean
  lead_days: number | null
  silence_days: number | null
  private_note: string | null
  source: string
  created_at: string
  updated_at: string
}

export function mapSpecialDate(raw: Record<string, unknown>) {
  const r = raw as Partial<SpecialDateRow>
  return {
    id: r.id as string,
    userId: r.user_id as string,
    contactId: r.contact_id as string,
    label: r.label as string,
    type: r.type as 'celebrate' | 'acknowledge' | 'silence' | 'check_in',
    recurring: !!r.recurring,
    source: (r.source ?? 'manual') as 'manual' | 'derived_first_met' | 'derived_company_start',
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    ...(r.date_anniversary != null ? { dateAnniversary: r.date_anniversary } : {}),
    ...(r.date_full != null ? { dateFull: r.date_full } : {}),
    ...(r.lead_days != null ? { leadDays: r.lead_days } : {}),
    ...(r.silence_days != null ? { silenceDays: r.silence_days } : {}),
    ...(r.private_note != null ? { privateNote: r.private_note } : {}),
  }
}

const Schema = z.object({ contactId: z.string().uuid().optional() })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const parsed = Schema.safeParse({ contactId: req.query['contactId'] })
  if (!parsed.success) return res.status(400).json({ error: 'contactId inválido' })

  const supabase = getSupabase()
  let q = supabase.from('special_dates').select('*').eq('user_id', user.id)
  if (parsed.data.contactId) q = q.eq('contact_id', parsed.data.contactId)

  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    specialDates: (data ?? []).map(r => mapSpecialDate(r as Record<string, unknown>)),
  })
}
