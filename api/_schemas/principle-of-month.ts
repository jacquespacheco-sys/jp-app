import { z } from 'zod'

const CarnegiePrincipleRegex = /^P([1-9]|[12][0-9]|30)$/
const MonthRegex = /^\d{4}-\d{2}$/

export const PrincipleOfMonthSaveSchema = z.object({
  principle: z.string().regex(CarnegiePrincipleRegex),
  month: z.string().regex(MonthRegex),
  targetApplications: z.number().int().positive().max(100).default(12),
  reflection: z.string().optional(),
})

export type PrincipleOfMonthSaveInput = z.infer<typeof PrincipleOfMonthSaveSchema>

export const PrincipleOfMonthQuerySchema = z.object({
  month: z.string().regex(MonthRegex).optional(),
})

export type PrincipleOfMonthQueryInput = z.infer<typeof PrincipleOfMonthQuerySchema>
