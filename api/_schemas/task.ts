import { z } from 'zod'

export const TaskSaveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  notes: z.string().default(''),
  status: z.enum(['inbox', 'next', 'doing', 'blocked', 'done']).default('inbox'),
  priority: z.enum(['high', 'med', 'low']).default('med'),
  projectId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
  startOffset: z.number().int().optional(),
  duration: z.number().int().optional(),
  dependsOn: z.array(z.string().uuid()).default([]),
})

export type TaskSaveInput = z.infer<typeof TaskSaveSchema>

export const TaskArchiveSchema = z.object({
  id: z.string().uuid(),
})

export type TaskArchiveInput = z.infer<typeof TaskArchiveSchema>
