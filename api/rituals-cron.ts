import './_env.js'
import { requireCron } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { Resend } from 'resend'
import { htmlEscape } from './_anthropic.js'
import { formatInTimeZone } from 'date-fns-tz'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 300

const WINDOW_MIN = 15

type Ritual = 'gratitude' | 'reflection' | 'principle' | 'thank-you-tour'

interface RitualConfig {
  subject: string
  body: (userName: string) => string
}

const RITUAL_CONFIG: Record<Ritual, RitualConfig> = {
  gratitude: {
    subject: 'Sexta-feira · diário de gratidão',
    body: name => `${name}, é sexta. Reserve 5 minutos para registrar 1-3 entradas no diário de gratidão. Você pode escolher mandar ou guardar — ambos contam.`,
  },
  reflection: {
    subject: 'Domingo · reflexão semanal',
    body: name => `${name}, fim de semana. 3 perguntas: quem te marcou esta semana? Quem você decepcionou? Quem você quer reaproximar?`,
  },
  principle: {
    subject: 'Novo mês · princípio Carnegie',
    body: name => `${name}, primeiro de mês. Escolha 1 dos 30 princípios Carnegie para praticar conscientemente. Pode ser o mesmo do mês passado se ainda há trabalho.`,
  },
  'thank-you-tour': {
    subject: 'Trimestre novo · Thank You Tour',
    body: name => `${name}, novo trimestre. Veja a lista dos contatos mais lembrados nos últimos 90 dias (no diário de gratidão) e mande uma mensagem para cada um.`,
  },
}

interface UserRow {
  id: string
  email: string
  name: string
  timezone: string | null
}

interface LocalNow {
  hhmm: string
  hourMin: number
  weekday: number  // 0=Sun..6=Sat
  dom: number      // 1..31
  month: number    // 1..12
  dateStr: string  // YYYY-MM-DD
}

function userLocal(tz: string): LocalNow {
  const now = new Date()
  const hhmm = formatInTimeZone(now, tz, 'HH:mm')
  const parts = hhmm.split(':')
  const h = parseInt(parts[0] ?? '0', 10)
  const m = parseInt(parts[1] ?? '0', 10)
  const weekdayStr = formatInTimeZone(now, tz, 'i') // 1..7, Mon=1
  const weekdayIso = parseInt(weekdayStr, 10)
  const weekday = weekdayIso === 7 ? 0 : weekdayIso // → 0=Sun..6=Sat
  const dom = parseInt(formatInTimeZone(now, tz, 'd'), 10)
  const month = parseInt(formatInTimeZone(now, tz, 'M'), 10)
  const dateStr = formatInTimeZone(now, tz, 'yyyy-MM-dd')
  return { hhmm, hourMin: h * 60 + m, weekday, dom, month, dateStr }
}

function inWindow(actualMin: number, targetMin: number, windowMin: number): boolean {
  return Math.abs(actualMin - targetMin) <= windowMin
}

function pickRitual(now: LocalNow, principleSet: boolean): Ritual | null {
  // Gratitude: Friday 18:00 local
  if (now.weekday === 5 && inWindow(now.hourMin, 18 * 60, WINDOW_MIN)) return 'gratitude'
  // Reflection: Sunday 19:00 local
  if (now.weekday === 0 && inWindow(now.hourMin, 19 * 60, WINDOW_MIN)) return 'reflection'
  // Principle: first Monday of month at 09:00
  if (now.weekday === 1 && now.dom <= 7 && inWindow(now.hourMin, 9 * 60, WINDOW_MIN) && !principleSet) return 'principle'
  // Thank You Tour: first day of quarter at 09:00
  if (now.dom === 1 && [1, 4, 7, 10].includes(now.month) && inWindow(now.hourMin, 9 * 60, WINDOW_MIN)) return 'thank-you-tour'
  return null
}

async function alreadySent(userId: string, ritual: Ritual, dateStr: string): Promise<boolean> {
  const supabase = getSupabase()
  const marker = `<!-- ritual-${ritual}-${dateStr} -->`
  const { data } = await supabase
    .from('coach_log')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'callout')
    .like('content_md', `${marker}%`)
    .limit(1)
  return (data ?? []).length > 0
}

async function principleSetForMonth(userId: string, month: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('principle_of_month')
    .select('id')
    .eq('user_id', userId)
    .eq('month', month)
    .limit(1)
  return (data ?? []).length > 0
}

function buildEmailHtml(ritual: Ritual, body: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><body style="background:#0a0a0a;color:#f0f0f0;font-family:-apple-system,system-ui,sans-serif;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:40px 24px">
  <div style="font-family:monospace;font-size:13px;letter-spacing:4px;font-weight:700;color:#7dd3fc;margin-bottom:24px">STATE</div>
  <div style="border-left:2px solid #7dd3fc;padding:20px">
    <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:10px">ritual · ${ritual}</div>
    <div style="font-size:14px;line-height:1.65;color:#ddd">${htmlEscape(body)}</div>
  </div>
</div></body></html>`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireCron(req, res)) return

  const supabase = getSupabase()
  const { data: users } = await supabase.from('users').select('id, email, name, timezone')

  const results: Array<{ userId: string; ritual?: Ritual; status: string; error?: string }> = []

  for (const u of (users ?? []) as UserRow[]) {
    const tz = u.timezone ?? 'America/Sao_Paulo'
    const now = userLocal(tz)
    const monthStr = `${now.dateStr.slice(0, 7)}`

    const principleAlready = await principleSetForMonth(u.id, monthStr)
    const ritual = pickRitual(now, principleAlready)
    if (!ritual) {
      results.push({ userId: u.id, status: 'out-of-window' })
      continue
    }

    if (await alreadySent(u.id, ritual, now.dateStr)) {
      results.push({ userId: u.id, ritual, status: 'already-sent' })
      continue
    }

    try {
      const cfg = RITUAL_CONFIG[ritual]
      const body = cfg.body(u.name)
      const marker = `<!-- ritual-${ritual}-${now.dateStr} -->`

      await supabase.from('coach_log').insert({
        user_id: u.id,
        kind: 'callout',
        direction: 'coach_to_user',
        content_md: `${marker}\n${body}`,
      })

      const resendKey = process.env['RESEND_API_KEY']
      const fromEmail = process.env['RESEND_FROM_EMAIL'] ?? 'briefing@state.is'
      if (resendKey) {
        try {
          const resend = new Resend(resendKey)
          await resend.emails.send({
            from: fromEmail,
            to: u.email,
            subject: cfg.subject,
            html: buildEmailHtml(ritual, body),
          })
        } catch (e) {
          console.error('[rituals-cron] email failed:', e instanceof Error ? e.message : e)
        }
      }

      results.push({ userId: u.id, ritual, status: 'sent' })
    } catch (e) {
      results.push({ userId: u.id, ritual, status: 'error', error: e instanceof Error ? e.message : 'unknown' })
    }
  }

  return res.status(200).json({ results })
}
