import { rrulestr } from 'rrule'

export function nextOccurrence(rrule: string, after: Date): Date | null {
  if (!rrule || !rrule.startsWith('FREQ=')) return null
  try {
    const rule = rrulestr(`DTSTART:${toRruleDateUtc(after)}\nRRULE:${rrule}`)
    const next = rule.after(after, false)
    return next ?? null
  } catch {
    return null
  }
}

function toRruleDateUtc(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  )
}
