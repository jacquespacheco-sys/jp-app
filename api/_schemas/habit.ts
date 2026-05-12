import { z } from 'zod'

// cadence: jsonb. Schemas válidos:
// { type: 'daily' }
// { type: 'weekdays' }                         // seg-sex
// { type: 'weekly', days: ['MO','WE','FR'] }   // dias específicos
// { type: 'every_n_days', n: 2 }
// { type: 'monthly', dayOfMonth: 15 }
const CadenceSchema = z.union([
  z.object({ type: z.literal('daily') }),
  z.object({ type: z.literal('weekdays') }),
  z.object({ type: z.literal('weekly'), days: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).min(1) }),
  z.object({ type: z.literal('every_n_days'), n: z.number().int().min(1).max(30) }),
  z.object({ type: z.literal('monthly'), dayOfMonth: z.number().int().min(1).max(31) }),
])

export const HabitSaveSchema = z.object({
  id: z.string().uuid().optional(),
  identity: z.string().min(1).max(200),       // "sou alguém que..."
  title: z.string().min(1).max(200),          // ex: "leitura"
  action: z.string().min(1).max(200),         // ex: "ler 30 minutos"
  minDose: z.string().min(1).max(200),        // ex: "ler 1 página"
  cue: z.string().max(500).optional(),
  reward: z.string().max(500).optional(),
  quadrant: z.enum(['I', 'IT', 'WE', 'ITS']),
  cadence: CadenceSchema,
  scheduleTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),  // HH:MM ou HH:MM:SS
  stackAfterHabitId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  active: z.boolean().default(true),
})

export type HabitSaveInput = z.input<typeof HabitSaveSchema>

export const HabitArchiveSchema = z.object({
  id: z.string().uuid(),
})

export const HabitLogSaveSchema = z.object({
  habitId: z.string().uuid(),
  doneOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dose: z.enum(['full', 'min', 'skip']),
  note: z.string().max(500).optional(),
})

export type HabitLogSaveInput = z.input<typeof HabitLogSaveSchema>

export const RitualSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  triggerTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  description: z.string().max(1000).optional(),
  active: z.boolean().default(true),
  steps: z.array(z.object({
    position: z.number().int().min(0),
    habitId: z.string().uuid().optional(),
    customStep: z.string().max(500).optional(),
    estimatedMin: z.number().int().positive().optional(),
  }).refine(s => s.habitId || s.customStep, { message: 'cada step precisa de habitId OU customStep' })).default([]),
})

export type RitualSaveInput = z.input<typeof RitualSaveSchema>

export const RitualArchiveSchema = z.object({
  id: z.string().uuid(),
})
