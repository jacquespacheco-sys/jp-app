import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD')

// -------------------------------------------------------------
// Chief Aim
// -------------------------------------------------------------
export const ChiefAimCreateSchema = z.object({
  aimText: z.string().min(1).max(4000),
  deadline: dateOnly,
  exchangeText: z.string().min(1).max(4000),
  planText: z.string().max(8000).optional(),
  nextReview: dateOnly.optional(),
})
export type ChiefAimCreateInput = z.input<typeof ChiefAimCreateSchema>

// aim_text e deadline são imutáveis — só meta editável
export const ChiefAimPatchSchema = z.object({
  id: z.string().uuid(),
  planText: z.string().max(8000).optional(),
  exchangeText: z.string().min(1).max(4000).optional(),
})
export type ChiefAimPatchInput = z.input<typeof ChiefAimPatchSchema>

// -------------------------------------------------------------
// Goals
// -------------------------------------------------------------
const GOAL_LEVELS = ['dream', 'goal', 'quarterly'] as const
const GOAL_STATUSES = ['active', 'completed', 'archived', 'failed'] as const

export const GoalSaveSchema = z.object({
  id: z.string().uuid().optional(),
  level: z.enum(GOAL_LEVELS),
  title: z.string().min(1).max(500),
  chiefAimId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  metricText: z.string().max(500).optional(),
  metricValue: z.number().optional(),
  metricUnit: z.string().max(100).optional(),
  progressPct: z.number().min(0).max(100).optional(),
  deadline: dateOnly.optional(),
  status: z.enum(GOAL_STATUSES).default('active'),
  linkedProjectId: z.string().uuid().optional(),
})
export type GoalSaveInput = z.input<typeof GoalSaveSchema>

export const GoalProgressSchema = z.object({
  id: z.string().uuid(),
  progressPct: z.number().min(0).max(100),
})
export type GoalProgressInput = z.input<typeof GoalProgressSchema>

export const GoalIdSchema = z.object({ id: z.string().uuid() })
export type GoalIdInput = z.input<typeof GoalIdSchema>

// -------------------------------------------------------------
// Affirmations
// -------------------------------------------------------------
const DIMENSIONS = ['identidade', 'acao', 'capacidade', 'relacoes', 'integracao'] as const

const AffirmationItemSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  text: z.string().min(1).max(2000),
  beliefScore: z.number().int().min(1).max(5),
  derivedFrom: z.object({ evidences: z.array(z.string().uuid()) }).optional(),
})

// POST de uma sessão inteira do wizard — substitui as ativas atomicamente
export const AffirmationWizardSchema = z.object({
  chiefAimId: z.string().uuid(),
  affirmations: z.array(AffirmationItemSchema).min(1).max(5)
    .refine(
      (arr) => new Set(arr.map((a) => a.dimension)).size === arr.length,
      'dimensões não podem repetir',
    ),
})
export type AffirmationWizardInput = z.input<typeof AffirmationWizardSchema>

// Cria uma (sem id) ou refina uma existente (com id → cria nova superseding)
export const AffirmationSaveSchema = z.object({
  id: z.string().uuid().optional(),
  chiefAimId: z.string().uuid(),
  dimension: z.enum(DIMENSIONS),
  text: z.string().min(1).max(2000),
  beliefScore: z.number().int().min(1).max(5),
  derivedFrom: z.object({ evidences: z.array(z.string().uuid()) }).optional(),
})
export type AffirmationSaveInput = z.input<typeof AffirmationSaveSchema>

export const AffirmationRetireSchema = z.object({
  id: z.string().uuid(),
  retiredReason: z.string().max(500).optional(),
})
export type AffirmationRetireInput = z.input<typeof AffirmationRetireSchema>

// Refina (cria nova versão superseding) — só legítimo na revisão trimestral (D3)
export const AffirmationRefineSchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(2000),
  beliefScore: z.number().int().min(1).max(5),
})
export type AffirmationRefineInput = z.input<typeof AffirmationRefineSchema>

// -------------------------------------------------------------
// Revisão trimestral (Fase 4)
// -------------------------------------------------------------
const AffirmationDecisionSchema = z.object({
  affId: z.string().uuid(),
  decision: z.enum(['kept', 'refined', 'replaced', 'retired']),
  newAffId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
})

export const ReviewSaveSchema = z.object({
  id: z.string().uuid(),
  aimDecision: z.enum(['kept', 'adjusted', 'rewritten']).optional(),
  affirmationDecisions: z.array(AffirmationDecisionSchema).optional(),
  complete: z.boolean().optional(),
})
export type ReviewSaveInput = z.input<typeof ReviewSaveSchema>

// -------------------------------------------------------------
// Rituals
// -------------------------------------------------------------
export const RitualStartSchema = z.object({
  type: z.enum(['morning', 'night']),
})
export type RitualStartInput = z.input<typeof RitualStartSchema>

export const RitualStepSchema = z.object({
  id: z.string().uuid(),
  step: z.string().min(1).max(100),
  affirmationRead: z.string().uuid().optional(),
  affirmationSkipped: z.string().uuid().optional(),
})
export type RitualStepInput = z.input<typeof RitualStepSchema>

const ReflectionSchema = z.object({
  what_brought_closer: z.string().max(2000).optional(),
  what_pushed_away: z.string().max(2000).optional(),
  next_action: z.string().max(2000).optional(),
}).partial()

export const RitualCompleteSchema = z.object({
  id: z.string().uuid(),
  durationSeconds: z.number().int().nonnegative().optional(),
  stepsCompleted: z.array(z.string().max(100)).optional(),
  affirmationsRead: z.array(z.string().uuid()).optional(),
  affirmationsSkipped: z.array(z.string().uuid()).optional(),
  reflectionData: ReflectionSchema.optional(),
  gratitudeItems: z.array(z.string().max(500)).optional(),
  dailyActionTaskId: z.string().uuid().optional(),
})
export type RitualCompleteInput = z.input<typeof RitualCompleteSchema>

// -------------------------------------------------------------
// Coach Hill (Fase 2)
// -------------------------------------------------------------
export const CoachChatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
})
export type CoachChatInput = z.input<typeof CoachChatSchema>

export const CoachWizardStepSchema = z.object({
  dimension: z.enum(DIMENSIONS),
  draft: z.string().min(1).max(2000),
})
export type CoachWizardStepInput = z.input<typeof CoachWizardStepSchema>

export const CoachMurmurSchema = z.object({
  context: z.string().min(1).max(500),
})
export type CoachMurmurInput = z.input<typeof CoachMurmurSchema>

export const HillPreferencesSchema = z.object({
  coachVoice: z.enum(['strict', 'mixed', 'gentle']).optional(),
  dailyNudgeEnabled: z.boolean().optional(),
  ritualMurmursEnabled: z.boolean().optional(),
  disabledCategories: z.array(z.string().max(40)).optional(),
  nudgeHour: z.number().int().min(0).max(23).optional(),
})
export type HillPreferencesInput = z.input<typeof HillPreferencesSchema>

export const NudgeFeedbackSchema = z.object({
  coachMessageId: z.string().uuid(),
  rating: z.number().int().min(-1).max(1),
  reason: z.string().max(500).optional(),
})
export type NudgeFeedbackInput = z.input<typeof NudgeFeedbackSchema>
