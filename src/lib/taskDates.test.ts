import { describe, it, expect } from 'vitest'
import { dueDayKey, dueBucket, localDayOf, localDayStr, addDaysStr } from './taskDates.ts'

describe('dueDayKey', () => {
  it('reads dueAt as the local calendar day', () => {
    const iso = '2026-05-23T15:00:00.000Z'
    expect(dueDayKey({ dueAt: iso })).toBe(localDayStr(new Date(iso)))
  })

  it('prefers dueAt over dueDate (dueAt is the source of truth)', () => {
    const iso = '2026-05-23T15:00:00.000Z'
    const key = dueDayKey({ dueAt: iso, dueDate: '2026-01-01T00:00:00+00:00' })
    expect(key).toBe(localDayStr(new Date(iso)))
  })

  // Regression: due_date comes from a timestamptz column, so the API returns a
  // full ISO string ('2026-05-23T00:00:00+00:00'), not 'YYYY-MM-DD'. The old
  // code returned it raw, so it never equalled today's 'YYYY-MM-DD'.
  it('normalizes a full-ISO dueDate (timestamptz) to its date portion', () => {
    expect(dueDayKey({ dueDate: '2026-05-23T00:00:00+00:00' })).toBe('2026-05-23')
  })

  // A Google Tasks due is an all-day date stored at midnight UTC. It must NOT
  // be shifted to the previous local day (the trap of converting to local in
  // a negative-offset zone). Deterministic regardless of the test machine's TZ.
  it('keeps a midnight-UTC dueAt (Google all-day) on its UTC calendar day', () => {
    expect(dueDayKey({ dueAt: '2026-05-23T00:00:00.000Z' })).toBe('2026-05-23')
    expect(dueDayKey({ dueAt: '2026-05-23T00:00:00+00:00' })).toBe('2026-05-23')
  })

  it('still accepts a date-only dueDate', () => {
    expect(dueDayKey({ dueDate: '2026-05-20' })).toBe('2026-05-20')
  })

  it('returns null when there is no due', () => {
    expect(dueDayKey({})).toBeNull()
  })
})

describe('dueBucket', () => {
  const today = '2026-05-23'
  const in7 = addDaysStr(today, 7)

  // The headline bug: a task due today landed in "Próximos 7 dias" because the
  // raw timestamptz key never equalled today. With dueDayKey normalizing first,
  // it must bucket as 'today'.
  it('buckets a task due today (from a full-ISO due_date) as today', () => {
    const key = dueDayKey({ dueDate: '2026-05-23T00:00:00+00:00' })
    expect(dueBucket(key, 'next', today, in7)).toBe('today')
  })

  // The reported bug for synced tasks: a Google task due today landed in next7.
  it('buckets a Google all-day task due today as today, not next7', () => {
    const key = dueDayKey({ dueAt: '2026-05-23T00:00:00.000Z', dueDate: '2026-05-23T00:00:00+00:00' })
    expect(dueBucket(key, 'next', today, in7)).toBe('today')
  })

  it('buckets a past due as overdue', () => {
    expect(dueBucket('2026-05-20', 'next', today, in7)).toBe('overdue')
  })

  it('buckets a due within 7 days as next7', () => {
    expect(dueBucket('2026-05-26', 'next', today, in7)).toBe('next7')
  })

  it('buckets an undated task as undated', () => {
    expect(dueBucket(null, 'next', today, in7)).toBe('undated')
  })

  it('pulls a doing task with no date into today', () => {
    expect(dueBucket(null, 'doing', today, in7)).toBe('today')
  })
})

describe('localDayOf', () => {
  // Guards against reverting to toISOString().slice(0,10), which uses UTC and
  // shifts evening-local times to the next day in negative-offset zones.
  it('uses the local calendar day, not UTC', () => {
    const iso = '2026-05-24T01:30:00.000Z'
    expect(localDayOf(iso)).toBe(localDayStr(new Date(iso)))
  })

  it('returns null for undefined', () => {
    expect(localDayOf(undefined)).toBeNull()
  })
})
