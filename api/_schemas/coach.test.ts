import { describe, it, expect } from 'vitest'
import {
  CoachChatSchema, CoachChatHistorySchema,
  CoachMemoryExtractSchema, CoachMemoryAcceptSchema, CoachMemoryDismissSchema,
  CoachProfileSaveSchema, CoachMemorySaveSchema,
} from './coach.js'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('CoachChatSchema', () => {
  it('aceita mensagem válida', () => {
    expect(CoachChatSchema.safeParse({ content: 'oi' }).success).toBe(true)
  })
  it('rejeita vazio', () => {
    expect(CoachChatSchema.safeParse({ content: '' }).success).toBe(false)
  })
  it('rejeita longo demais', () => {
    expect(CoachChatSchema.safeParse({ content: 'x'.repeat(8001) }).success).toBe(false)
  })
})

describe('CoachChatHistorySchema', () => {
  it('default limit = 50', () => {
    const r = CoachChatHistorySchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.limit).toBe(50)
  })
  it('coerce string-number', () => {
    const r = CoachChatHistorySchema.safeParse({ limit: '20' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.limit).toBe(20)
  })
  it('rejeita limit > 200', () => {
    expect(CoachChatHistorySchema.safeParse({ limit: 999 }).success).toBe(false)
  })
  it('aceita before como ISO datetime', () => {
    expect(CoachChatHistorySchema.safeParse({ before: '2026-05-12T10:00:00.000Z' }).success).toBe(true)
  })
})

describe('CoachMemoryExtractSchema', () => {
  it('aceita sem sinceLogId', () => {
    expect(CoachMemoryExtractSchema.safeParse({}).success).toBe(true)
  })
  it('aceita sinceLogId UUID', () => {
    expect(CoachMemoryExtractSchema.safeParse({ sinceLogId: UUID }).success).toBe(true)
  })
  it('rejeita sinceLogId não-UUID', () => {
    expect(CoachMemoryExtractSchema.safeParse({ sinceLogId: 'abc' }).success).toBe(false)
  })
})

describe('CoachMemoryAcceptSchema', () => {
  it('aceita só candidateId', () => {
    expect(CoachMemoryAcceptSchema.safeParse({ candidateId: UUID }).success).toBe(true)
  })
  it('aceita com edits parciais', () => {
    expect(CoachMemoryAcceptSchema.safeParse({
      candidateId: UUID, content: 'novo', relevance: 70,
    }).success).toBe(true)
  })
  it('rejeita relevance fora de 0-100', () => {
    expect(CoachMemoryAcceptSchema.safeParse({ candidateId: UUID, relevance: 150 }).success).toBe(false)
  })
})

describe('CoachMemoryDismissSchema', () => {
  it('exige candidateId UUID', () => {
    expect(CoachMemoryDismissSchema.safeParse({ candidateId: UUID }).success).toBe(true)
    expect(CoachMemoryDismissSchema.safeParse({}).success).toBe(false)
  })
})

describe('CoachProfileSaveSchema (com email check-in)', () => {
  it('default emailMorning=true emailEvening=false', () => {
    const r = CoachProfileSaveSchema.safeParse({})
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.checkInSchedule.emailMorning).toBe(true)
      expect(r.data.checkInSchedule.emailEvening).toBe(false)
    }
  })
  it('aceita schedule completo', () => {
    expect(CoachProfileSaveSchema.safeParse({
      checkInSchedule: {
        morning: '07:30', evening: '21:00',
        emailMorning: false, emailEvening: true,
        weeklyDay: 'SU', weeklyTime: '09:00',
      },
    }).success).toBe(true)
  })
  it('rejeita horário inválido', () => {
    expect(CoachProfileSaveSchema.safeParse({
      checkInSchedule: { morning: '7am' },
    }).success).toBe(false)
  })
})

describe('CoachMemorySaveSchema (regressão)', () => {
  it('aceita save mínimo', () => {
    expect(CoachMemorySaveSchema.safeParse({ kind: 'fact', content: 'oi' }).success).toBe(true)
  })
})
