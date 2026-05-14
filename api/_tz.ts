import { formatInTimeZone } from 'date-fns-tz'

export type IsoWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface UserLocalNow {
  /** "HH:mm" no fuso do user */
  hhmm: string
  /** minutos do dia (0–1439) */
  hourMin: number
  /** 0=Sun, 1=Mon, ..., 6=Sat (compatível com Date.getDay) */
  weekday: number
  /** ISO 2-char ("MO".."SU") */
  weekdayIso: IsoWeekday
  /** dia do mês (1..31) */
  dom: number
  /** mês (1..12) */
  month: number
  /** "YYYY-MM-DD" */
  dateStr: string
  /** "YYYY-MM" */
  monthStr: string
}

const ISO_MAP: Record<string, IsoWeekday> = {
  '1': 'MO', '2': 'TU', '3': 'WE', '4': 'TH', '5': 'FR', '6': 'SA', '7': 'SU',
}

export function defaultTz(timezone: string | null | undefined): string {
  return timezone || 'America/Sao_Paulo'
}

export function userLocalNow(timezone: string | null | undefined): UserLocalNow {
  const tz = defaultTz(timezone)
  const now = new Date()
  const hhmm = formatInTimeZone(now, tz, 'HH:mm')
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr ?? '0', 10)
  const m = parseInt(mStr ?? '0', 10)
  const isoDow = formatInTimeZone(now, tz, 'i') // 1..7 (Mon..Sun)
  const weekdayIso = ISO_MAP[isoDow] ?? 'MO'
  const weekday = isoDow === '7' ? 0 : parseInt(isoDow, 10)
  const dom = parseInt(formatInTimeZone(now, tz, 'd'), 10)
  const month = parseInt(formatInTimeZone(now, tz, 'M'), 10)
  const dateStr = formatInTimeZone(now, tz, 'yyyy-MM-dd')
  const monthStr = formatInTimeZone(now, tz, 'yyyy-MM')
  return { hhmm, hourMin: h * 60 + m, weekday, weekdayIso, dom, month, dateStr, monthStr }
}

/** True se o horário atual cai dentro da janela `targetHHMM ± windowMin` minutos. */
export function inMinuteWindow(now: UserLocalNow, targetHHMM: string, windowMin: number): boolean {
  const [thStr, tmStr] = targetHHMM.split(':')
  const th = parseInt(thStr ?? '0', 10)
  const tm = parseInt(tmStr ?? '0', 10)
  if (isNaN(th) || isNaN(tm)) return false
  return Math.abs(now.hourMin - (th * 60 + tm)) <= windowMin
}
