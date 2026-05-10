import { z } from 'zod'

export const QuadrantSchema = z.enum(['I', 'IT', 'WE', 'ITS'])

export const AreaSaveSchema = z.object({
  id: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/, 'slug deve ser kebab-case'),
  quadrant: QuadrantSchema,
  visionH4: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  position: z.number().int().optional(),
})
export type AreaSaveInput = z.infer<typeof AreaSaveSchema>

export const AreaArchiveSchema = z.object({
  id: z.string().uuid(),
  archive: z.boolean().default(true),
})
export type AreaArchiveInput = z.infer<typeof AreaArchiveSchema>
