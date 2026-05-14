import { z } from 'zod'

export const SPECIAL_DATE_TYPES = ['celebrate', 'acknowledge', 'silence', 'check_in'] as const
export const SPECIAL_DATE_SOURCES = ['manual', 'derived_first_met', 'derived_company_start'] as const

export const SpecialDateSaveSchema = z.object({
  id: z.string().uuid().optional(),
  contactId: z.string().uuid(),
  label: z.string().min(1).max(200),
  type: z.enum(SPECIAL_DATE_TYPES),
  dateAnniversary: z.string().regex(/^\d{2}\/\d{2}$/).optional(),
  dateFull: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recurring: z.boolean().default(true),
  leadDays: z.number().int().min(0).max(60).default(2),
  silenceDays: z.number().int().positive().optional(),
  privateNote: z.string().optional(),
  source: z.enum(SPECIAL_DATE_SOURCES).default('manual'),
}).refine(d => d.dateAnniversary != null || d.dateFull != null, {
  message: 'dateAnniversary ou dateFull obrigatório',
  path: ['dateAnniversary'],
})

export type SpecialDateSaveInput = z.infer<typeof SpecialDateSaveSchema>
