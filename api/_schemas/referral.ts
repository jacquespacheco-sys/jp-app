import { z } from 'zod'

export const REFERRAL_STATUSES = ['open', 'closed', 'dropped'] as const

export const ReferralSaveSchema = z.object({
  id: z.string().uuid().optional(),
  fromContactId: z.string().uuid(),
  toContactId: z.string().uuid().optional(),
  context: z.string().min(1).max(500),
  outcomeNote: z.string().optional(),
  feedbackGiven: z.boolean().default(false),
  feedbackGivenAt: z.string().datetime().optional(),
  status: z.enum(REFERRAL_STATUSES).default('open'),
})

export type ReferralSaveInput = z.infer<typeof ReferralSaveSchema>

export const ReferralStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REFERRAL_STATUSES).optional(),
  feedbackGiven: z.boolean().optional(),
  outcomeNote: z.string().optional(),
}).refine(d => d.status != null || d.feedbackGiven != null || d.outcomeNote != null, {
  message: 'nada para atualizar',
})

export type ReferralStatusUpdateInput = z.infer<typeof ReferralStatusUpdateSchema>
