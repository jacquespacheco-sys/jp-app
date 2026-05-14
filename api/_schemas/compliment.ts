import { z } from 'zod'

export const ComplimentSaveSchema = z.object({
  id: z.string().uuid().optional(),
  contactId: z.string().uuid(),
  text: z.string().min(1).max(1000),
  receivedAt: z.string().datetime().optional(),
  context: z.string().optional(),
  remindToReciprocateAt: z.string().datetime().optional(),
})

export type ComplimentSaveInput = z.infer<typeof ComplimentSaveSchema>

export const ComplimentReciprocateSchema = z.object({
  id: z.string().uuid(),
  reciprocationNote: z.string().optional(),
})

export type ComplimentReciprocateInput = z.infer<typeof ComplimentReciprocateSchema>
