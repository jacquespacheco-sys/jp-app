import './_env.js'
import { requireCron } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { Resend } from 'resend'
import { htmlEscape } from './_anthropic.js'
import { userLocalNow, inMinuteWindow } from './_tz.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 300

const TARGET_HHMM = '08:00'
const WINDOW_MIN = 15

interface UserRow {
  id: string
  email: string
  name: string
  timezone: string | null
}

async function alreadySent(userId: string, dateStr: string): Promise<boolean> {
  const supabase = getSupabase()
  const marker = `<!-- special-dates-${dateStr} -->`
  const { data } = await supabase
    .from('coach_log')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'callout')
    .like('content_md', `${marker}%`)
    .limit(1)
  return (data ?? []).length > 0
}

interface DayItem {
  kind: 'birthday' | 'celebrate' | 'check_in'
  label: string
  contactName: string
}

async function fetchTodayItems(userId: string, ddmm: string, fullDate: string): Promise<DayItem[]> {
  const supabase = getSupabase()
  const [bRes, sRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('first_name, last_name, birthday')
      .eq('user_id', userId)
      .eq('archived', false)
      .eq('birthday', ddmm),
    supabase
      .from('special_dates')
      .select('label, type, contacts:contact_id(first_name, last_name)')
      .eq('user_id', userId)
      .in('type', ['celebrate', 'check_in'])
      .or(`date_anniversary.eq.${ddmm},date_full.eq.${fullDate}`),
  ])

  const items: DayItem[] = []
  for (const b of (bRes.data ?? []) as { first_name: string; last_name: string | null }[]) {
    items.push({
      kind: 'birthday',
      label: 'Aniversário',
      contactName: b.last_name ? `${b.first_name} ${b.last_name}` : b.first_name,
    })
  }
  type SdRow = {
    label: string; type: string
    contacts: { first_name: string; last_name: string | null } | { first_name: string; last_name: string | null }[] | null
  }
  for (const s of (sRes.data ?? []) as unknown as SdRow[]) {
    const c = Array.isArray(s.contacts) ? s.contacts[0] : s.contacts
    items.push({
      kind: s.type as 'celebrate' | 'check_in',
      label: s.label,
      contactName: c ? (c.last_name ? `${c.first_name} ${c.last_name}` : c.first_name) : '—',
    })
  }
  return items
}

function buildEmailHtml(items: DayItem[], dateLabel: string): string {
  const rows = items.map(i => {
    const icon = i.kind === 'birthday' ? '🎂' : i.kind === 'check_in' ? '🌱' : '✨'
    return `<div style="padding:10px 0;border-bottom:1px solid #1c1c1c;font-size:14px;color:#ddd">
      ${icon} <strong>${htmlEscape(i.label)}</strong> — <span style="color:#888">${htmlEscape(i.contactName)}</span>
    </div>`
  }).join('')

  return `<!DOCTYPE html><html lang="pt-BR"><body style="background:#0a0a0a;color:#f0f0f0;font-family:-apple-system,system-ui,sans-serif;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:40px 24px">
  <div style="font-family:monospace;font-size:13px;letter-spacing:4px;font-weight:700;color:#7dd3fc;margin-bottom:24px">STATE</div>
  <div style="border-left:2px solid #a8ff00;padding:20px">
    <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:14px">datas de hoje · ${htmlEscape(dateLabel)}</div>
    ${rows}
  </div>
</div></body></html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireCron(req, res)) return

  const supabase = getSupabase()
  const { data: users } = await supabase.from('users').select('id, email, name, timezone')

  const results: Array<{ userId: string; status: string; items?: number; error?: string }> = []

  for (const u of (users ?? []) as UserRow[]) {
    const now = userLocalNow(u.timezone)
    if (!inMinuteWindow(now, TARGET_HHMM, WINDOW_MIN)) {
      results.push({ userId: u.id, status: 'out-of-window' })
      continue
    }

    const fullDate = now.dateStr
    const ddmm = `${String(now.dom).padStart(2, '0')}/${String(now.month).padStart(2, '0')}`
    const dateLabel = `${ddmm}/${fullDate.slice(0, 4)}`

    if (await alreadySent(u.id, fullDate)) {
      results.push({ userId: u.id, status: 'already-sent' })
      continue
    }

    try {
      const items = await fetchTodayItems(u.id, ddmm, fullDate)
      if (items.length === 0) {
        results.push({ userId: u.id, status: 'empty' })
        continue
      }

      const marker = `<!-- special-dates-${fullDate} -->`
      const contentMd = `${marker}\n${items.map(i => `- ${i.label}: ${i.contactName}`).join('\n')}`

      await supabase.from('coach_log').insert({
        user_id: u.id,
        kind: 'callout',
        direction: 'coach_to_user',
        content_md: contentMd,
      })

      const resendKey = process.env['RESEND_API_KEY']
      const fromEmail = process.env['RESEND_FROM_EMAIL'] ?? 'briefing@state.is'
      if (resendKey) {
        try {
          const resend = new Resend(resendKey)
          await resend.emails.send({
            from: fromEmail,
            to: u.email,
            subject: `Datas de hoje — ${items.length} ${items.length === 1 ? 'pessoa' : 'pessoas'}`,
            html: buildEmailHtml(items, dateLabel),
          })
        } catch (e) {
          console.error('[special-dates-cron] email failed:', e instanceof Error ? e.message : e)
        }
      }

      results.push({ userId: u.id, status: 'sent', items: items.length })
    } catch (e) {
      results.push({ userId: u.id, status: 'error', error: e instanceof Error ? e.message : 'unknown' })
    }
  }

  return res.status(200).json({ results })
}
