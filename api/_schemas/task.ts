import { z } from 'zod'

export const TaskSaveSchema = z.object({
  // legados
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  notes: z.string().default(''),
  status: z.enum([
    'inbox', 'next', 'doing', 'blocked', 'done',
    'waiting', 'scheduled', 'someday', 'cancelled',
  ]).default('inbox'),
  priority: z.enum(['high', 'med', 'low']).default('med'),
  projectId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string()).default([]),
  startOffset: z.number().int().optional(),
  duration: z.number().int().optional(),
  dependsOn: z.array(z.string().uuid()).default([]),

  // AQAL/GTD novos (todos opcionais)
  areaId: z.string().uuid().optional(),
  quadrantOverride: z.enum(['I', 'IT', 'WE', 'ITS']).optional(),
  context: z.enum(['deep', 'shallow', 'social', 'criativo', 'somatico', 'offline']).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  timeEstimateMin: z.number().int().positive().optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  waitingFor: z.string().optional(),
  rrule: z.string().regex(/^FREQ=/).optional(),
  parentTaskId: z.string().uuid().optional(),
  source: z.enum(['manual', 'voice', 'email', 'briefing', 'coach', 'google']).default('manual'),
})

export type TaskSaveInput = z.infer<typeof TaskSaveSchema>

export const TaskArchiveSchema = z.object({
  id: z.string().uuid(),
})

export type TaskArchiveInput = z.infer<typeof TaskArchiveSchema>
