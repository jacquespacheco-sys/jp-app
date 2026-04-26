import { z } from 'zod'

export const ContactSaveSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().min(1).max(200),
  lastName: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  birthday: z.string().regex(/^\d{2}\/\d{2}$/).optional(),
  tags: z.array(z.string()).default([]),
  phase: z.enum(['prospect', 'first', 'talking', 'proposal', 'active', 'dormant']).optional(),
  nextContact: z.string().optional(),
  notes: z.string().default(''),
})

export type ContactSaveInput = z.infer<typeof ContactSaveSchema>

export const InteractionSaveSchema = z.object({
  contactId: z.string().uuid(),
  date: z.string().datetime(),
  type: z.enum(['call', 'meeting', 'email', 'message']),
  note: z.string().default(''),
})

export type InteractionSaveInput = z.infer<typeof InteractionSaveSchema>
