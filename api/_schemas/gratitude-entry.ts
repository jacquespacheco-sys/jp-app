import { z } from 'zod'

export const GRATITUDE_CHANNELS = ['whatsapp', 'email', 'linkedin', 'sms', 'phone'] as const

export const GratitudeEntrySaveSchema = z.object({
  contactId: z.string().uuid().optional(),
  text: z.string().min(1).max(280),
  shared: z.boolean().default(false),
  sharedChannel: z.enum(GRATITUDE_CHANNELS).optional(),
})

export type GratitudeEntrySaveInput = z.infer<typeof GratitudeEntrySaveSchema>
