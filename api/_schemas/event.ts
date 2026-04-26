import { z } from 'zod'

export const EventSaveSchema = z.object({
  id: z.string().uuid().optional(),
  calendarId: z.string().uuid(),
  summary: z.string().min(1).max(500),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  timezone: z.string().optional(),
  status: z.enum(['confirmed', 'tentative', 'cancelled']).default('confirmed'),
})

export type EventSaveInput = z.infer<typeof EventSaveSchema>

export const EventDeleteSchema = z.object({
  id: z.string().uuid(),
})

export type EventDeleteInput = z.infer<typeof EventDeleteSchema>

export const EventParseSchema = z.object({
  text: z.string().min(1).max(500),
  lang: z.enum(['pt', 'en', 'auto']).default('auto'),
})

export type EventParseInput = z.infer<typeof EventParseSchema>

export const ParsedEventSchema = z.object({
  summary: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  location: z.string().nullable(),
  calendarHint: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().nullable(),
})

export type ParsedEvent = z.infer<typeof ParsedEventSchema>

export const CalendarToggleSchema = z.object({
  id: z.string().uuid(),
  isVisible: z.boolean().optional(),
  customColor: z.string().optional(),
  isDefaultForCreate: z.boolean().optional(),
})

export type CalendarToggleInput = z.infer<typeof CalendarToggleSchema>
