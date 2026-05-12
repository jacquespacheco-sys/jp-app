import { z } from 'zod'

export const ProjectSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  title: z.string().optional(),
  outcome: z.string().optional(),
  color: z.string().regex(/^#/).default('#7dd3fc'),
  kind: z.enum(['outcome', 'evergreen']).default('outcome'),
  status: z.enum(['active', 'on_hold', 'someday', 'done', 'archived']).default('active'),
  horizon: z.enum(['H0', 'H1', 'H2', 'H3', 'H4', 'H5']).default('H1'),
  areaId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  quadrantOverride: z.enum(['I', 'IT', 'WE', 'ITS']).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  position: z.number().int().default(0),
})

export type ProjectSaveInput = z.input<typeof ProjectSaveSchema>
export type ProjectSaveOutput = z.output<typeof ProjectSaveSchema>

export const ProjectArchiveSchema = z.object({
  id: z.string().uuid(),
})
export type ProjectArchiveInput = z.infer<typeof ProjectArchiveSchema>

export const ProjectCompleteSchema = z.object({
  id: z.string().uuid(),
})
export type ProjectCompleteInput = z.infer<typeof ProjectCompleteSchema>
