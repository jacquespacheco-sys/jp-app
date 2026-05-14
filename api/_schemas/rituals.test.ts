import { describe, it, expect } from 'vitest'
import { SpecialDateSaveSchema } from './special-date.js'
import { ReferralSaveSchema, ReferralStatusUpdateSchema } from './referral.js'
import { ComplimentSaveSchema, ComplimentReciprocateSchema } from './compliment.js'
import { PrincipleOfMonthSaveSchema, PrincipleOfMonthQuerySchema } from './principle-of-month.js'
import { WeeklyReflectionSaveSchema, WeeklyReflectionHandledSchema } from './weekly-reflection.js'
import { GratitudeEntrySaveSchema } from './gratitude-entry.js'

const UUID = '00000000-0000-0000-0000-000000000001'
const UUID2 = '00000000-0000-0000-0000-000000000002'

describe('SpecialDateSaveSchema', () => {
  const base = { contactId: UUID, label: 'Aniversário', type: 'celebrate' as const }

  it('aceita date_anniversary DD/MM', () => {
    const r = SpecialDateSaveSchema.safeParse({ ...base, dateAnniversary: '12/05' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.recurring).toBe(true)
  })

  it('aceita date_full YYYY-MM-DD', () => {
    expect(SpecialDateSaveSchema.safeParse({ ...base, dateFull: '2026-05-12' }).success).toBe(true)
  })

  it('rejeita sem nenhuma data', () => {
    expect(SpecialDateSaveSchema.safeParse(base).success).toBe(false)
  })

  it('rejeita type inválido', () => {
    expect(SpecialDateSaveSchema.safeParse({ ...base, dateAnniversary: '01/01', type: 'party' }).success).toBe(false)
  })

  it('aceita todos os 4 types', () => {
    for (const t of ['celebrate', 'acknowledge', 'silence', 'check_in']) {
      expect(SpecialDateSaveSchema.safeParse({ ...base, type: t, dateAnniversary: '01/01' }).success).toBe(true)
    }
  })
})

describe('ReferralSaveSchema', () => {
  const base = { fromContactId: UUID, context: 'apresentou Marina' }

  it('aceita payload mínimo', () => {
    const r = ReferralSaveSchema.safeParse(base)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.status).toBe('open')
      expect(r.data.feedbackGiven).toBe(false)
    }
  })

  it('aceita toContactId UUID', () => {
    expect(ReferralSaveSchema.safeParse({ ...base, toContactId: UUID2 }).success).toBe(true)
  })

  it('rejeita context vazio', () => {
    expect(ReferralSaveSchema.safeParse({ ...base, context: '' }).success).toBe(false)
  })

  it('rejeita status inválido', () => {
    expect(ReferralSaveSchema.safeParse({ ...base, status: 'pending' }).success).toBe(false)
  })
})

describe('ReferralStatusUpdateSchema', () => {
  it('exige pelo menos um campo de mudança', () => {
    expect(ReferralStatusUpdateSchema.safeParse({ id: UUID }).success).toBe(false)
  })

  it('aceita só status', () => {
    expect(ReferralStatusUpdateSchema.safeParse({ id: UUID, status: 'closed' }).success).toBe(true)
  })

  it('aceita só feedbackGiven', () => {
    expect(ReferralStatusUpdateSchema.safeParse({ id: UUID, feedbackGiven: true }).success).toBe(true)
  })
})

describe('ComplimentSaveSchema', () => {
  it('aceita payload mínimo', () => {
    expect(ComplimentSaveSchema.safeParse({
      contactId: UUID, text: 'achou a apresentação ótima',
    }).success).toBe(true)
  })

  it('rejeita text vazio', () => {
    expect(ComplimentSaveSchema.safeParse({ contactId: UUID, text: '' }).success).toBe(false)
  })

  it('rejeita text > 1000 chars', () => {
    expect(ComplimentSaveSchema.safeParse({ contactId: UUID, text: 'x'.repeat(1001) }).success).toBe(false)
  })

  it('aceita receivedAt e remindToReciprocateAt ISO', () => {
    expect(ComplimentSaveSchema.safeParse({
      contactId: UUID,
      text: 'obrigado',
      receivedAt: '2026-05-12T10:00:00.000Z',
      remindToReciprocateAt: '2026-09-12T10:00:00.000Z',
    }).success).toBe(true)
  })
})

describe('ComplimentReciprocateSchema', () => {
  it('exige id UUID', () => {
    expect(ComplimentReciprocateSchema.safeParse({ id: UUID }).success).toBe(true)
    expect(ComplimentReciprocateSchema.safeParse({}).success).toBe(false)
  })

  it('aceita nota opcional', () => {
    expect(ComplimentReciprocateSchema.safeParse({ id: UUID, reciprocationNote: 'mandei um WhatsApp' }).success).toBe(true)
  })
})

describe('PrincipleOfMonthSaveSchema', () => {
  it('aceita P1..P30 e default targetApplications=12', () => {
    const r = PrincipleOfMonthSaveSchema.safeParse({ principle: 'P7', month: '2026-05' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.targetApplications).toBe(12)
  })

  it('rejeita principle fora do range', () => {
    expect(PrincipleOfMonthSaveSchema.safeParse({ principle: 'P0', month: '2026-05' }).success).toBe(false)
    expect(PrincipleOfMonthSaveSchema.safeParse({ principle: 'P31', month: '2026-05' }).success).toBe(false)
    expect(PrincipleOfMonthSaveSchema.safeParse({ principle: 'p7', month: '2026-05' }).success).toBe(false)
  })

  it('rejeita month em formato errado', () => {
    expect(PrincipleOfMonthSaveSchema.safeParse({ principle: 'P1', month: '05/2026' }).success).toBe(false)
    expect(PrincipleOfMonthSaveSchema.safeParse({ principle: 'P1', month: '2026-5' }).success).toBe(false)
  })

  it('rejeita targetApplications zero ou > 100', () => {
    expect(PrincipleOfMonthSaveSchema.safeParse({ principle: 'P1', month: '2026-05', targetApplications: 0 }).success).toBe(false)
    expect(PrincipleOfMonthSaveSchema.safeParse({ principle: 'P1', month: '2026-05', targetApplications: 101 }).success).toBe(false)
  })
})

describe('PrincipleOfMonthQuerySchema', () => {
  it('aceita query vazia', () => {
    expect(PrincipleOfMonthQuerySchema.safeParse({}).success).toBe(true)
  })
  it('aceita month válido', () => {
    expect(PrincipleOfMonthQuerySchema.safeParse({ month: '2026-05' }).success).toBe(true)
  })
})

describe('WeeklyReflectionSaveSchema', () => {
  it('aceita week ISO YYYY-Wxx', () => {
    expect(WeeklyReflectionSaveSchema.safeParse({ week: '2026-W19' }).success).toBe(true)
  })

  it('rejeita week mal formado', () => {
    expect(WeeklyReflectionSaveSchema.safeParse({ week: '2026-19' }).success).toBe(false)
    expect(WeeklyReflectionSaveSchema.safeParse({ week: '2026W19' }).success).toBe(false)
    expect(WeeklyReflectionSaveSchema.safeParse({ week: '2026-w19' }).success).toBe(false)
  })

  it('aceita as 3 perguntas opcionais', () => {
    expect(WeeklyReflectionSaveSchema.safeParse({
      week: '2026-W19',
      markedMeContactId: UUID, markedMeWhy: 'pdf com pesquisa',
      letDownContactId: UUID2, letDownWhy: 'esqueci o callback',
      reconnectContactId: UUID, reconnectHandled: false,
    }).success).toBe(true)
  })
})

describe('WeeklyReflectionHandledSchema', () => {
  it('exige id e reconnectHandled', () => {
    expect(WeeklyReflectionHandledSchema.safeParse({ id: UUID, reconnectHandled: true }).success).toBe(true)
    expect(WeeklyReflectionHandledSchema.safeParse({ id: UUID }).success).toBe(false)
  })
})

describe('GratitudeEntrySaveSchema', () => {
  it('aceita até 280 chars', () => {
    expect(GratitudeEntrySaveSchema.safeParse({ text: 'x'.repeat(280) }).success).toBe(true)
  })

  it('rejeita > 280 chars', () => {
    expect(GratitudeEntrySaveSchema.safeParse({ text: 'x'.repeat(281) }).success).toBe(false)
  })

  it('rejeita vazio', () => {
    expect(GratitudeEntrySaveSchema.safeParse({ text: '' }).success).toBe(false)
  })

  it('aceita contactId opcional + shared + sharedChannel', () => {
    expect(GratitudeEntrySaveSchema.safeParse({
      contactId: UUID, text: 'pelo café', shared: true, sharedChannel: 'whatsapp',
    }).success).toBe(true)
  })

  it('rejeita sharedChannel inválido', () => {
    expect(GratitudeEntrySaveSchema.safeParse({ text: 'oi', sharedChannel: 'telegram' }).success).toBe(false)
  })
})
