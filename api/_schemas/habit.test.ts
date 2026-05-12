import { describe, it, expect } from 'vitest'
import {
  HabitSaveSchema, HabitArchiveSchema, HabitLogSaveSchema,
  RitualSaveSchema, RitualArchiveSchema,
} from './habit.js'

const baseHabit = {
  identity: 'leitor',
  title: 'leitura matinal',
  action: 'ler 30 minutos',
  minDose: 'ler 1 página',
  quadrant: 'I' as const,
  cadence: { type: 'daily' as const },
}

describe('HabitSaveSchema', () => {
  it('aceita habit mínimo', () => {
    expect(HabitSaveSchema.safeParse(baseHabit).success).toBe(true)
  })

  it('rejeita identity vazio', () => {
    expect(HabitSaveSchema.safeParse({ ...baseHabit, identity: '' }).success).toBe(false)
  })

  it('aceita 4 quadrantes', () => {
    for (const q of ['I', 'IT', 'WE', 'ITS'] as const) {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, quadrant: q }).success).toBe(true)
    }
  })

  describe('cadence', () => {
    it('aceita daily', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'daily' } }).success).toBe(true)
    })
    it('aceita weekdays', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'weekdays' } }).success).toBe(true)
    })
    it('aceita weekly com dias', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'weekly', days: ['MO', 'WE'] } }).success).toBe(true)
    })
    it('rejeita weekly sem dias', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'weekly', days: [] } }).success).toBe(false)
    })
    it('aceita every_n_days', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'every_n_days', n: 3 } }).success).toBe(true)
    })
    it('rejeita every_n_days n=0', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'every_n_days', n: 0 } }).success).toBe(false)
    })
    it('aceita monthly', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'monthly', dayOfMonth: 15 } }).success).toBe(true)
    })
    it('rejeita monthly dayOfMonth fora de 1-31', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, cadence: { type: 'monthly', dayOfMonth: 32 } }).success).toBe(false)
    })
  })

  describe('scheduleTime', () => {
    it('aceita HH:MM', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, scheduleTime: '07:00' }).success).toBe(true)
    })
    it('aceita HH:MM:SS', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, scheduleTime: '07:00:00' }).success).toBe(true)
    })
    it('rejeita formato inválido', () => {
      expect(HabitSaveSchema.safeParse({ ...baseHabit, scheduleTime: '7am' }).success).toBe(false)
    })
  })

  it('default active é true', () => {
    const r = HabitSaveSchema.safeParse(baseHabit)
    if (r.success) expect(r.data.active).toBe(true)
  })
})

describe('HabitArchiveSchema', () => {
  it('exige id UUID', () => {
    expect(HabitArchiveSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    expect(HabitArchiveSchema.safeParse({}).success).toBe(false)
  })
})

describe('HabitLogSaveSchema', () => {
  const uuid = '00000000-0000-0000-0000-000000000001'

  it('aceita full/min/skip', () => {
    for (const d of ['full', 'min', 'skip'] as const) {
      expect(HabitLogSaveSchema.safeParse({
        habitId: uuid, doneOn: '2026-05-12', dose: d,
      }).success).toBe(true)
    }
  })

  it('rejeita dose inválida', () => {
    expect(HabitLogSaveSchema.safeParse({
      habitId: uuid, doneOn: '2026-05-12', dose: 'maybe',
    }).success).toBe(false)
  })

  it('rejeita doneOn inválido', () => {
    expect(HabitLogSaveSchema.safeParse({
      habitId: uuid, doneOn: '12/05/2026', dose: 'full',
    }).success).toBe(false)
  })
})

describe('RitualSaveSchema', () => {
  it('aceita ritual mínimo', () => {
    expect(RitualSaveSchema.safeParse({ name: 'manhã' }).success).toBe(true)
  })

  it('aceita steps com habitId', () => {
    const uuid = '00000000-0000-0000-0000-000000000001'
    expect(RitualSaveSchema.safeParse({
      name: 'manhã',
      steps: [{ position: 0, habitId: uuid, estimatedMin: 5 }],
    }).success).toBe(true)
  })

  it('aceita steps com customStep', () => {
    expect(RitualSaveSchema.safeParse({
      name: 'manhã',
      steps: [{ position: 0, customStep: 'meditar 5 min' }],
    }).success).toBe(true)
  })

  it('rejeita step sem habitId nem customStep', () => {
    expect(RitualSaveSchema.safeParse({
      name: 'manhã',
      steps: [{ position: 0, estimatedMin: 5 }],
    }).success).toBe(false)
  })
})

describe('RitualArchiveSchema', () => {
  it('exige id UUID', () => {
    expect(RitualArchiveSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    expect(RitualArchiveSchema.safeParse({}).success).toBe(false)
  })
})
