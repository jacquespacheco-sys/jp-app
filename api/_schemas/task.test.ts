import { describe, it, expect } from 'vitest'
import { TaskSaveSchema } from './task.js'

const baseValid = {
  title: 'Test',
  projectId: '00000000-0000-0000-0000-000000000001',
}

describe('TaskSaveSchema', () => {
  describe('status enum', () => {
    it('aceita status legados', () => {
      for (const status of ['inbox','next','doing','blocked','done'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, status }).success).toBe(true)
      }
    })

    it('aceita status novos AQAL/GTD', () => {
      for (const status of ['waiting','scheduled','someday','cancelled'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, status }).success).toBe(true)
      }
    })

    it('rejeita status desconhecido', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, status: 'pending' }).success).toBe(false)
    })
  })

  describe('AQAL fields', () => {
    it('aceita areaId UUID', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, areaId: '00000000-0000-0000-0000-000000000002' }).success).toBe(true)
    })

    it('rejeita areaId não-UUID', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, areaId: 'not-a-uuid' }).success).toBe(false)
    })

    it('aceita context válido', () => {
      for (const c of ['deep','shallow','social','criativo','somatico','offline'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, context: c }).success).toBe(true)
      }
    })

    it('aceita energy 1-5', () => {
      for (const e of [1, 2, 3, 4, 5]) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, energy: e }).success).toBe(true)
      }
    })

    it('rejeita energy fora de 1-5', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, energy: 0 }).success).toBe(false)
      expect(TaskSaveSchema.safeParse({ ...baseValid, energy: 6 }).success).toBe(false)
      expect(TaskSaveSchema.safeParse({ ...baseValid, energy: 2.5 }).success).toBe(false)
    })

    it('aceita timeEstimateMin positivo', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, timeEstimateMin: 30 }).success).toBe(true)
    })

    it('rejeita timeEstimateMin <= 0', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, timeEstimateMin: 0 }).success).toBe(false)
      expect(TaskSaveSchema.safeParse({ ...baseValid, timeEstimateMin: -5 }).success).toBe(false)
    })

    it('aceita quadrantOverride válido', () => {
      for (const q of ['I','IT','WE','ITS'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, quadrantOverride: q }).success).toBe(true)
      }
    })
  })

  describe('GTD fields', () => {
    it('aceita dueAt ISO datetime', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, dueAt: '2026-05-12T15:00:00.000Z' }).success).toBe(true)
    })

    it('rejeita dueAt em formato date-only', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, dueAt: '2026-05-12' }).success).toBe(false)
    })

    it('aceita scheduledAt ISO datetime', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, scheduledAt: '2026-05-12T15:00:00.000Z' }).success).toBe(true)
    })

    it('aceita waitingFor texto livre', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, waitingFor: 'cliente Z responder' }).success).toBe(true)
    })

    it('aceita rrule começando com FREQ=', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, rrule: 'FREQ=DAILY' }).success).toBe(true)
      expect(TaskSaveSchema.safeParse({ ...baseValid, rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' }).success).toBe(true)
    })

    it('rejeita rrule sem FREQ=', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, rrule: 'BYDAY=MO' }).success).toBe(false)
    })
  })

  describe('source default', () => {
    it('default é manual quando omitido', () => {
      const r = TaskSaveSchema.safeParse(baseValid)
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.source).toBe('manual')
    })
  })
})
