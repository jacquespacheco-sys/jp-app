import { z } from 'zod'

export const TIER_VALUES = ['inner', 'strong', 'network', 'weak', 'dormant'] as const
export const PREFERRED_CHANNEL_VALUES = ['whatsapp', 'email', 'linkedin', 'sms', 'phone'] as const
export const SENTIMENT_VALUES = ['positive', 'neutral', 'tense'] as const
export const INITIATOR_VALUES = ['me', 'them'] as const

const CarnegieTagRegex = /^P([1-9]|[12][0-9]|30)$/

const FamilySchema = z.object({
  spouse: z.string().optional(),
  children: z.array(z.string()).optional(),
  pets: z.array(z.string()).optional(),
})

const LastSignalSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
  url: z.string().url().optional(),
  date: z.string().optional(),
})

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

  tier: z.enum(TIER_VALUES).optional(),
  cadenceDays: z.number().int().positive().optional(),

  preferredName: z.string().optional(),
  pronunciation: z.string().optional(),

  interests: z.array(z.string()).optional(),
  conversationHooks: z.array(z.string()).optional(),
  whatTheyValue: z.string().optional(),
  theirGoals: z.string().optional(),
  family: FamilySchema.optional(),

  firstMetAt: z.string().datetime().optional(),
  companyStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  preferredChannel: z.enum(PREFERRED_CHANNEL_VALUES).optional(),
  favorBalance: z.number().int().optional(),

  linkedinUrl: z.string().url().optional(),
  twitterHandle: z.string().optional(),
  instagramHandle: z.string().optional(),

  lastSignal: LastSignalSchema.optional(),
  lastSignalAt: z.string().datetime().optional(),

  sourceContactId: z.string().uuid().optional(),
  sourceContext: z.string().optional(),
})

export type ContactSaveInput = z.infer<typeof ContactSaveSchema>

export const InteractionSaveSchema = z.object({
  contactId: z.string().uuid(),
  date: z.string().datetime(),
  type: z.enum(['call', 'meeting', 'email', 'message']),
  note: z.string().default(''),

  initiator: z.enum(INITIATOR_VALUES).optional(),
  sentiment: z.enum(SENTIMENT_VALUES).optional(),
  topicsDiscussed: z.array(z.string()).optional(),
  carnegieTags: z.array(z.string().regex(CarnegieTagRegex)).optional(),
  interactionTags: z.array(z.string()).optional(),
  complimentText: z.string().optional(),
  referralFromId: z.string().uuid().optional(),
  newLearning: z.string().optional(),
  promiseMade: z.string().optional(),
})

export type InteractionSaveInput = z.infer<typeof InteractionSaveSchema>
