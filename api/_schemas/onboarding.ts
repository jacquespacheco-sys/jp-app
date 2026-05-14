import { z } from 'zod'
import { TIER_VALUES } from './contact.js'

export const OnboardingBulkClassifyItemSchema = z.object({
  id: z.string().uuid(),
  tier: z.enum(TIER_VALUES).optional(),
  addHook: z.string().min(1).max(500).optional(),
  preferredChannel: z.enum(['whatsapp', 'email', 'linkedin', 'sms', 'phone']).optional(),
  linkedinUrl: z.string().url().optional(),
  cadenceDays: z.number().int().positive().optional(),
  categoryIds: z.array(z.string().uuid()).max(50).optional(),
})

export const OnboardingBulkClassifySchema = z.object({
  updates: z.array(OnboardingBulkClassifyItemSchema).min(1).max(100),
})

export type OnboardingBulkClassifyInput = z.infer<typeof OnboardingBulkClassifySchema>
export type OnboardingBulkClassifyItem = z.infer<typeof OnboardingBulkClassifyItemSchema>
