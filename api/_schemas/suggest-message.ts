import { z } from 'zod'

export const SUGGEST_INTENTS = [
  'reconnect', 'thank', 'follow_up', 'ask', 'congratulate', 'condolences', 'other',
] as const

export const ContactSuggestMessageSchema = z.object({
  contactId: z.string().uuid(),
  context: z.string().min(5).max(500),
  intent: z.enum(SUGGEST_INTENTS).optional(),
})

export type ContactSuggestMessageInput = z.infer<typeof ContactSuggestMessageSchema>
