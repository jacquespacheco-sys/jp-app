import { z } from 'zod'

export const ContactSetCategoriesSchema = z.object({
  contactId: z.string().uuid(),
  categoryIds: z.array(z.string().uuid()).max(100),
})

export type ContactSetCategoriesInput = z.infer<typeof ContactSetCategoriesSchema>
