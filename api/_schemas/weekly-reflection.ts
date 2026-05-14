import { z } from 'zod'

const WeekRegex = /^\d{4}-W\d{2}$/

export const WeeklyReflectionSaveSchema = z.object({
  week: z.string().regex(WeekRegex),
  markedMeContactId: z.string().uuid().optional(),
  markedMeWhy: z.string().optional(),
  letDownContactId: z.string().uuid().optional(),
  letDownWhy: z.string().optional(),
  reconnectContactId: z.string().uuid().optional(),
  reconnectHandled: z.boolean().default(false),
})

export type WeeklyReflectionSaveInput = z.infer<typeof WeeklyReflectionSaveSchema>

export const WeeklyReflectionHandledSchema = z.object({
  id: z.string().uuid(),
  reconnectHandled: z.boolean(),
})

export type WeeklyReflectionHandledInput = z.infer<typeof WeeklyReflectionHandledSchema>
