import './_env.js'
import { requireCron } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { Resend } from 'resend'
import {
  COACH_MODEL, buildCoachSnapshot, formatSnapshotForPrompt, getAnthropic,
} from './_coach.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const maxDuration = 300

type Slot = 'morning' | 'evening' | 'weekly'

interface UserWithProfile {
  id: string
  email: string
  name: string
  timezone: string
  coach_profile: {
    name: string
    check_in_schedule: Record<string, unknown>
  } | null
}

function timeInWindow(targetHHMM: string, nowHHMM: string, marginMin: number): boolean {
  const [th, tm] = targetHHMM.split(':').map(Number)
  const [nh, nm] = nowHHMM.split(':').map(Number)
  if (th == null || tm == null || nh == null || nm == null) return false
  const diff = Math.abs((nh * 60 + nm) - (th * 60 + tm))
  return diff <= marginMin
}

function userLocalTime(timezone: string): { hhmm: string; weekday: string; dateStr: string } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p => [p.type, p.value]))
  const hh = (parts['hour'] ?? '00').padStart(2, '0')
  const mm = (parts['minute'] ?? '00').padStart(2, '0')
  const wd = parts['weekday'] ?? ''
  const weekdayMap: Record<string, string> = { Sun: 'SU', Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA' }
  const dateStr = `${parts['year']}-${parts['month']}-${parts['day']}`
  return { hhmm: `${hh}:${mm}`, weekday: weekdayMap[wd] ?? '', dateStr }
}

async function checkAlreadySent(userId: string, slot: Slot, todayDateStr: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase.from('coach_log')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'check_in')
    .gte('created_at', `${todayDateStr}T00:00:00Z`)
    .like('content_md', `<!-- ${slot} -->%`)
    .limit(1)
  return (data ?? []).length > 0
}

function buildCheckInPrompt(slot: Slot, snapshotText: string, time: string, userName: string): string {
  const marker = `<!-- ${slot} -->`
  const intro =
    slot === 'morning' ? `São ${time} da manhã.` :
    slot === 'evening' ? `Fim do dia, ${time}.` :
                         `Início de semana.`
  const structure =
    slot === 'morning'
      ? `- uma observação concreta sobre o estado (não genérica)\n- uma cobrança OU celebração específica (cite áreas/projetos reais)\n- um foco pro dia (UMA coisa, não lista)`
      : slot === 'evening'
      ? `- o que foi feito hoje que importou (cite concreto)\n- o que ficou aberto e merece atenção\n- pergunta de fechamento (sem ser terapêutica)`
      : `- balanço da semana (AQAL 7d, áreas, projetos)\n- padrão que merece atenção\n- prioridade pra próxima semana (UMA)`

  const maxWords = slot === 'morning' ? 120 : slot === 'evening' ? 100 : 160

  return `Você é o sócio sênior de ${userName}. ${intro}

${snapshotText}

Escreva um check-in (máx ${maxWords} palavras) na voz firme-mas-gentil.
Estrutura sugerida:
${structure}

REGRAS:
- Letra minúscula no início. Sem emoji. Sem ponto de exclamação enfático.
- Comece a PRIMEIRA LINHA com o marker exato: ${marker}
- Depois do marker, pule linha e escreva o check-in.`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!requireCron(req, res)) return

  const supabase = getSupabase()

  const { data: users } = await supabase
    .from('users')
    .select('id,email,name,timezone, coach_profile(name,check_in_schedule)')

  const results: Array<{ userId: string; slot?: Slot; status: string; error?: string }> = []

  for (const userRow of (users ?? []) as unknown as UserWithProfile[]) {
    const profile = userRow.coach_profile
    if (!profile) {
      results.push({ userId: userRow.id, status: 'no-profile' })
      continue
    }
    const schedule = profile.check_in_schedule as Record<string, string | boolean | undefined>
    const { hhmm, weekday, dateStr } = userLocalTime(userRow.timezone)

    const morningTime = schedule['morning'] as string | undefined
    const eveningTime = schedule['evening'] as string | undefined
    const weeklyDay = schedule['weeklyDay'] as string | undefined
    const weeklyTime = schedule['weeklyTime'] as string | undefined

    let slot: Slot | null = null
    if (morningTime && timeInWindow(morningTime, hhmm, 15)) slot = 'morning'
    else if (eveningTime && timeInWindow(eveningTime, hhmm, 15)) slot = 'evening'
    else if (weeklyDay === weekday && weeklyTime && timeInWindow(weeklyTime, hhmm, 15)) slot = 'weekly'

    if (!slot) {
      results.push({ userId: userRow.id, status: 'out-of-window' })
      continue
    }

    if (await checkAlreadySent(userRow.id, slot, dateStr)) {
      results.push({ userId: userRow.id, slot, status: 'already-sent' })
      continue
    }

    try {
      const snapshot = await buildCoachSnapshot({
        userId: userRow.id,
        userName: userRow.name,
        ...(userRow.timezone ? { userTimezone: userRow.timezone } : {}),
      })
      const snapshotText = formatSnapshotForPrompt(snapshot, userRow.name)
      const prompt = buildCheckInPrompt(slot, snapshotText, hhmm, userRow.name)

      const anthropic = getAnthropic()
      const msg = await anthropic.messages.create({
        model: COACH_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
      const finalText = text.startsWith(`<!-- ${slot} -->`) ? text : `<!-- ${slot} -->\n${text}`
      const displayText = finalText.replace(`<!-- ${slot} -->`, '').replace(/^\s+/, '')

      await supabase.from('coach_log').insert({
        user_id: userRow.id,
        kind: 'check_in',
        direction: 'coach_to_user',
        content_md: finalText,
        model_used: COACH_MODEL,
        tokens_in: msg.usage.input_tokens,
        tokens_out: msg.usage.output_tokens,
      })

      const wantsEmail =
        (slot === 'morning' && schedule['emailMorning'] !== false) ||
        (slot === 'evening' && schedule['emailEvening'] === true)

      const resendKey = process.env['RESEND_API_KEY']
      const fromEmail = process.env['RESEND_FROM_EMAIL'] ?? 'briefing@state.is'
      if (wantsEmail && resendKey) {
        try {
          const resend = new Resend(resendKey)
          const subject = slot === 'morning' ? 'check-in matinal' :
                          slot === 'evening' ? 'check-in noturno' : 'check-in semanal'
          const html = `<!DOCTYPE html><html lang="pt-BR"><body style="background:#0a0a0a;color:#f0f0f0;font-family:-apple-system,system-ui,sans-serif;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:40px 24px">
  <div style="font-family:monospace;font-size:13px;letter-spacing:4px;font-weight:700;color:#7dd3fc;margin-bottom:24px">STATE</div>
  <div style="border-left:2px solid #7dd3fc;padding:20px">
    <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:10px">do coach · ${subject}</div>
    <div style="font-size:14px;line-height:1.65;color:#ddd;white-space:pre-wrap">${displayText.replace(/</g, '&lt;')}</div>
  </div>
</div></body></html>`
          await resend.emails.send({
            from: fromEmail,
            to: userRow.email,
            subject: `Coach — ${subject}`,
            html,
          })
        } catch (e) {
          console.error('[checkin-cron] email failed:', e instanceof Error ? e.message : e)
        }
      }

      results.push({ userId: userRow.id, slot, status: 'sent' })
    } catch (e) {
      results.push({
        userId: userRow.id, slot, status: 'error',
        error: e instanceof Error ? e.message : 'unknown',
      })
    }
  }

  return res.status(200).json({ results })
}
