import { z } from 'zod'

export const CATEGORY_COLORS = [
  'gray', 'red', 'orange', 'yellow', 'green',
  'teal', 'blue', 'purple', 'pink', 'accent',
] as const

const SlugRegex = /^[a-z0-9_-]+$/

export const CategorySaveSchema = z.object({
  id: z.string().uuid().optional(),
  dimensionId: z.string().uuid(),
  label: z.string().min(1).max(80),
  slug: z.string().regex(SlugRegex).min(1).max(80),
  color: z.enum(CATEGORY_COLORS).nullable().optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export type CategorySaveInput = z.infer<typeof CategorySaveSchema>

export const CategoryArchiveSchema = z.object({
  id: z.string().uuid(),
  archived: z.boolean(),
})

export type CategoryArchiveInput = z.infer<typeof CategoryArchiveSchema>
