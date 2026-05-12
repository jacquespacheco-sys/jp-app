import { describe, it, expect } from 'vitest'
import { nextOccurrence } from './rrule.js'

describe('nextOccurrence', () => {
  it('FREQ=DAILY retorna +1 dia', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=DAILY', after)
    expect(next).not.toBeNull()
    expect(next!.toISOString()).toBe('2026-05-12T08:00:00.000Z')
  })

  it('FREQ=WEEKLY;BYDAY=MO retorna próxima segunda', () => {
    // 2026-05-11 é uma segunda — próxima é 2026-05-18
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=WEEKLY;BYDAY=MO', after)
    expect(next).not.toBeNull()
    expect(next!.getUTCDay()).toBe(1)
    expect(next!.toISOString().slice(0, 10)).toBe('2026-05-18')
  })

  it('FREQ=MONTHLY retorna mesma data do mês seguinte', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=MONTHLY', after)
    expect(next).not.toBeNull()
    expect(next!.toISOString().slice(0, 10)).toBe('2026-06-11')
  })

  it('rrule com UNTIL no passado retorna null', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=DAILY;UNTIL=20260101T000000Z', after)
    expect(next).toBeNull()
  })

  it('rrule inválido retorna null', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    expect(nextOccurrence('INVALID', after)).toBeNull()
    expect(nextOccurrence('', after)).toBeNull()
  })
})
