import { z } from 'zod'

const SlugRegex = /^[a-z0-9_-]+$/

export const CategoryDimensionSaveSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(80),
  slug: z.string().regex(SlugRegex).min(1).max(80),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export type CategoryDimensionSaveInput = z.infer<typeof CategoryDimensionSaveSchema>

export const CategoryDimensionArchiveSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
})

export type CategoryDimensionArchiveInput = z.infer<typeof CategoryDimensionArchiveSchema>
