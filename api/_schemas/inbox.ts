import { z } from 'zod'

export const InboxCaptureSchema = z.object({
  rawText: z.string().min(1).max(2000),
  source: z.enum(['manual', 'voice', 'email', 'briefing', 'coach', 'google']).default('manual'),
  externalRef: z.string().optional(),
})

export type InboxCaptureInput = z.infer<typeof InboxCaptureSchema>

const InboxTaskFieldsSchema = z.object({
  title: z.string().min(1),
  projectId: z.string().uuid(),
  status: z.enum(['next', 'scheduled', 'someday', 'waiting']).default('next'),
  areaId: z.string().uuid().optional(),
  context: z.enum(['deep', 'shallow', 'social', 'criativo', 'somatico', 'offline']).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  timeEstimateMin: z.number().int().positive().optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  waitingFor: z.string().optional(),
})

export const InboxProcessSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['to_task', 'to_project', 'trash']),
  taskFields: InboxTaskFieldsSchema.optional(),
})

export type InboxProcessInput = z.infer<typeof InboxProcessSchema>
