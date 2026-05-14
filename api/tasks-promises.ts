import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { formatInTimeZone } from 'date-fns-tz'
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface PromiseRow {
  id: string
  title: string
  due_date: string | null
  due_at: string | null
  contact_id: string | null
  contacts: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: u } = await supabase.from('users').select('timezone').eq('id', user.id).single()
  const tz = (u?.timezone as string | undefined) ?? 'America/Sao_Paulo'
  const todayLocal = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, due_at, contact_id, contacts:contact_id(first_name, last_name)')
    .eq('user_id', user.id)
    .eq('archived', false)
    .not('status', 'in', '(done,cancelled)')
    .not('contact_id', 'is', null)
    .overlaps('tags', ['promessa', '#promessa'])

  if (error) return res.status(500).json({ error: error.message })

  const rows = ((data ?? []) as unknown as PromiseRow[]).filter(r => {
    const due = r.due_date ?? (r.due_at ? r.due_at.slice(0, 10) : null)
    return due != null && due < todayLocal
  })

  const promises = rows.map(r => {
    const c = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts
    return {
      id: r.id,
      title: r.title,
      dueDate: r.due_date ?? (r.due_at ? r.due_at.slice(0, 10) : null),
      contactId: r.contact_id,
      contactName: c ? (c.last_name ? `${c.first_name} ${c.last_name}` : c.first_name) : null,
    }
  })

  return res.status(200).json({
    promises,
    count: promises.length,
  })
}
