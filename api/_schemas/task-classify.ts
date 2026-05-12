import { z } from 'zod'

export const TaskClassifyRequestSchema = z.union([
  z.object({ taskId: z.string().uuid() }),
  z.object({ inboxItemId: z.string().uuid() }),
])

export type TaskClassifyRequest = z.infer<typeof TaskClassifyRequestSchema>

export const TaskClassifyResponseSchema = z.object({
  areaId: z.string().uuid().nullable(),
  context: z.enum(['deep', 'shallow', 'social', 'criativo', 'somatico', 'offline']).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  timeEstimateMin: z.number().int().positive().nullable(),
  rationale: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export type TaskClassifyResult = z.infer<typeof TaskClassifyResponseSchema>
