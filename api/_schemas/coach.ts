import { z } from 'zod'

export const CoachProfileSaveSchema = z.object({
  name: z.string().min(1).max(100).default('Coach'),
  tone: z.string().min(1).max(200).default('firme-mas-gentil'),
  voiceExamples: z.string().max(2000).optional(),
  valuesMd: z.array(z.string()).default([]),
  boundaries: z.string().max(2000).optional(),
  checkInSchedule: z.object({
    morning: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    evening: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    weeklyDay: z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']).optional(),
    weeklyTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }).default({}),
  systemPromptOverride: z.string().max(8000).optional(),
  northStarMd: z.string().max(4000).optional(),
  h3Goals: z.array(z.object({
    title: z.string().min(1),
    horizon: z.literal('H3'),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).default([]),
})

export type CoachProfileSaveInput = z.input<typeof CoachProfileSaveSchema>

export const CoachMemorySaveSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(['fact', 'pattern', 'promise', 'concern', 'preference']),
  content: z.string().min(1).max(2000),
  source: z.string().max(200).optional(),
  relatedAreaId: z.string().uuid().optional(),
  relatedProjectId: z.string().uuid().optional(),
  relatedTaskId: z.string().uuid().optional(),
  relevance: z.number().int().min(0).max(100).default(50),
  expiresAt: z.string().datetime().optional(),
})

export type CoachMemorySaveInput = z.input<typeof CoachMemorySaveSchema>

export const CoachMemoryArchiveSchema = z.object({
  id: z.string().uuid(),
})
