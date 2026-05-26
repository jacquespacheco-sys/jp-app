import type {
  Quadrant as QuadrantDB, HorizonLvl as HorizonLvlDB,
  TaskContext as TaskContextDB, ProjectKind as ProjectKindDB,
  ProjectStatusAqal, HabitDose as HabitDoseDB,
  MemoryKind as MemoryKindDB, CaptureSrc as CaptureSrcDB,
  HillGoalLevel as HillGoalLevelDB, HillGoalStatus as HillGoalStatusDB,
  HillAffirmationDimension as HillAffirmationDimensionDB,
  HillAffirmationStatus as HillAffirmationStatusDB,
  HillRitualType as HillRitualTypeDB,
} from './database.ts'

export type Quadrant = QuadrantDB
export type HorizonLvl = HorizonLvlDB
export type TaskContext = TaskContextDB
export type ProjectKind = ProjectKindDB
export type ProjectStatusType = ProjectStatusAqal
export type HabitDose = HabitDoseDB
export type MemoryKind = MemoryKindDB
export type CaptureSrc = CaptureSrcDB

export type TaskStatus =
  | 'inbox' | 'next' | 'doing' | 'blocked' | 'done'
  | 'waiting' | 'scheduled' | 'someday' | 'cancelled'
export type TaskPriority = 'high' | 'med' | 'low'

export interface Task {
  id: string
  userId: string
  projectId: string
  contactId?: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  dueDate?: string
  startOffset?: number
  duration?: number
  dependsOn: string[]
  archived: boolean
  archivedAt?: string
  googleTasksId?: string
  synced: boolean
  createdAt: string
  updatedAt: string
  // AQAL/GTD (campos opcionais; resolvedQuadrant é só preenchido pela view v_tasks_resolved)
  areaId?: string
  quadrantOverride?: Quadrant
  resolvedQuadrant?: Quadrant
  context?: TaskContext
  energy?: number
  timeEstimateMin?: number
  dueAt?: string
  scheduledAt?: string
  completedAt?: string
  waitingFor?: string
  rrule?: string
  rruleParentId?: string
  parentTaskId?: string
  source: CaptureSrc
  aiClassified: boolean
}

export interface Project {
  id: string
  userId: string
  name: string
  color: string
  googleTaskListId?: string
  archived: boolean
  createdAt: string
  updatedAt: string
  // AQAL (campos novos opcionais — vêm da view v_projects_with_counts)
  title?: string
  outcome?: string
  kind: ProjectKind
  status: ProjectStatusType
  horizon: HorizonLvl
  areaId?: string
  parentId?: string
  quadrantOverride?: Quadrant
  resolvedQuadrant?: Quadrant
  targetDate?: string
  position: number
  completedAt?: string
  archivedAt?: string
  // Agregados (preenchidos pelo endpoint, não enviados no save)
  taskCount: number
  taskOpenCount: number
  childCount: number
}

export interface ContactFamily {
  spouse?: string
  children?: string[]
  pets?: string[]
}

export interface ContactSignal {
  type?: string
  text?: string
  url?: string
  date?: string
}

export type ContactTier = 'inner' | 'strong' | 'network' | 'weak' | 'dormant'
export type ContactChannel = 'whatsapp' | 'email' | 'linkedin' | 'sms' | 'phone'

export interface Contact {
  id: string
  userId: string
  firstName: string
  lastName?: string
  company?: string
  role?: string
  email?: string
  phone?: string
  address?: string
  birthday?: string
  tags: string[]
  phase?: string
  nextContact?: string
  notes: string
  googleContactId?: string
  synced: boolean
  archived: boolean
  archivedAt?: string
  createdAt: string
  updatedAt: string

  tier?: ContactTier
  cadenceDays?: number
  lastInteractionAt?: string
  preferredName?: string
  pronunciation?: string
  interests?: string[]
  conversationHooks?: string[]
  whatTheyValue?: string
  theirGoals?: string
  family?: ContactFamily
  firstMetAt?: string
  companyStartDate?: string
  preferredChannel?: ContactChannel
  favorBalance?: number
  linkedinUrl?: string
  twitterHandle?: string
  instagramHandle?: string
  lastSignal?: ContactSignal
  lastSignalAt?: string
  sourceContactId?: string
  sourceContext?: string

  // Hidratado quando vier de v_contacts_with_categories (PR8)
  categories?: Category[]
}

export interface CalendarEvent {
  id: string
  userId: string
  calendarId: string
  googleEventId?: string
  icalUid?: string
  summary: string
  description?: string
  location?: string
  startAt: string
  endAt: string
  allDay: boolean
  timezone?: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  recurrence?: string[]
  recurringEventId?: string
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: string
  }>
  organizerEmail?: string
  isOrganizer: boolean
  source: 'google' | 'jp_app' | 'task_block'
  taskId?: string
  synced: boolean
  etag?: string
  createdAt: string
  updatedAt: string
}

export interface Calendar {
  id: string
  userId: string
  googleCalendarId: string
  summary: string
  description?: string
  googleColorId?: string
  customColor?: string
  isPrimary: boolean
  isVisible: boolean
  isDefaultForCreate: boolean
  accessRole?: string
  syncToken?: string
  lastSyncAt?: string
  createdAt: string
  updatedAt: string
}

export interface Briefing {
  id: string
  userId: string
  date: string
  highlight: string
  content: BriefingContent
  emailSent: boolean
  emailSentAt?: string
  model: string
  tokenCount?: number
  cost?: number
  createdAt: string
  coachParagraph?: string
}

export interface BriefingContent {
  global: BriefingItem[]
  brasil: BriefingItem[]
  newsletters: BriefingItem[]
  agenda: CalendarEvent[]
  tasks: Task[]
}

export interface BriefingItem {
  source: string
  title: string
  summary: string
  url: string
}

export type InteractionInitiator = 'me' | 'them'
export type InteractionSentiment = 'positive' | 'neutral' | 'tense'

export interface Interaction {
  id: string
  contactId: string
  date: string
  type: 'call' | 'meeting' | 'email' | 'message'
  note: string
  createdAt: string

  initiator?: InteractionInitiator
  sentiment?: InteractionSentiment
  topicsDiscussed?: string[]
  carnegieTags?: string[]
  interactionTags?: string[]
  complimentText?: string
  referralFromId?: string
  newLearning?: string
  promiseMade?: string
}

export interface Source {
  id: string
  name: string
  url: string
  active: boolean
  lastFetch?: string
  createdAt: string
}

export interface Newsletter {
  id: string
  name: string
  senderEmail: string
  active: boolean
  lastFetch?: string
  createdAt: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  timezone: string
  theme: string
}

export type NoteType = 'postit' | 'text' | 'audio' | 'link'

export interface NoteFolder {
  id: string
  userId: string
  parentId?: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface NoteTag {
  id: string
  userId: string
  name: string
  color: string
  createdAt: string
}

export interface Note {
  id: string
  userId: string
  folderId?: string
  type: NoteType
  title?: string
  content: string
  url?: string
  thumbnailUrl?: string
  audioDuration?: number
  pinned: boolean
  archived: boolean
  tagIds: string[]
  createdAt: string
  updatedAt: string
}

export interface NewsItem {
  id: string
  userId: string
  sourceId?: string
  title: string
  url: string
  summary?: string
  content?: string
  author?: string
  imageUrl?: string
  publishedAt: string
  favorited: boolean
  read: boolean
  createdAt: string
}

// =============================================================
// AQAL/GTD (additivo)
// =============================================================

export interface Area {
  id: string
  userId: string
  parentId?: string
  name: string
  slug: string
  quadrant: Quadrant
  visionH4?: string
  color?: string
  icon?: string
  position: number
  archivedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AreaAggregate {
  areaId: string
  name: string
  quadrant: Quadrant
  completed: number
  open: number
}

export interface QuadrantAggregate {
  quadrant: Quadrant
  completed: number
  minutes: number
}

export interface AqalTotals {
  completedThisWeek: number
  minutesThisWeek: number
  openTasks: number
}

// -------------------------------------------------------------
// Constantes UI
// -------------------------------------------------------------
export const QUADRANT_LABELS: Record<Quadrant, string> = {
  I: 'Interior individual',
  IT: 'Comportamento',
  WE: 'Coletivo cultural',
  ITS: 'Sistemas',
}

/**
 * Cores AQAL — paleta Seda.
 * - QUADRANT_COLORS: hex sólido (legacy, ícones, badges, project picker)
 * - QUADRANT_COLORS_SOFT: rgba translúcido para chips, barras, fundos
 * - QUADRANT_COLORS_INK: cor de texto sobre fundo soft (contraste)
 * - QUADRANT_VARS: nomes de CSS variables — prefira estes em vez de hex literal
 *
 * Mapeamento:
 *   I   = lilás (interior, mente, espírito)
 *   IT  = sage (corpo, ações físicas)
 *   WE  = peach-warm (relações)
 *   ITS = sky (sistemas)
 */
export const QUADRANT_COLORS: Record<Quadrant, string> = {
  I: '#DFD0EC',
  IT: '#C9DDC9',
  WE: '#F0CFA8',
  ITS: '#CFE3E8',
}

export const QUADRANT_COLORS_SOFT: Record<Quadrant, string> = {
  I: 'rgba(223, 208, 236, 0.6)',
  IT: 'rgba(201, 221, 201, 0.6)',
  WE: 'rgba(240, 207, 168, 0.6)',
  ITS: 'rgba(207, 227, 232, 0.6)',
}

export const QUADRANT_COLORS_INK: Record<Quadrant, string> = {
  I: '#6B5E72',
  IT: '#5C8159',
  WE: '#A06C4C',
  ITS: '#5D8194',
}

export const QUADRANT_VARS: Record<Quadrant, { soft: string; ink: string; barClass: string }> = {
  I:   { soft: 'var(--color-lilac)',      ink: 'var(--color-lilac-ink)',      barClass: 'q-i'   },
  IT:  { soft: 'var(--color-sage)',       ink: 'var(--color-sage-ink)',       barClass: 'q-it'  },
  WE:  { soft: 'var(--color-peach-warm)', ink: 'var(--color-peach-warm-ink)', barClass: 'q-we'  },
  ITS: { soft: 'var(--color-sky)',        ink: 'var(--color-sky-ink)',        barClass: 'q-its' },
}

/** Converte hex `#RRGGBB` em rgba com alpha (default 0.5). Para project.color (user-defined). */
export function projectColorSoft(hex: string, alpha = 0.5): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return hex
  const h = m[1]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// =============================================================
// Inbox (GTD captura/triagem)
// =============================================================

export interface InboxItem {
  id: string
  userId: string
  rawText: string
  source: CaptureSrc
  externalRef?: string
  aiSuggestion?: {
    areaId?: string
    context?: TaskContext
    energy?: number
    timeEstimateMin?: number
    rationale: string
  }
  processed: boolean
  processedToTask?: string
  processedToProject?: string
  createdAt: string
  processedAt?: string
}

export type InboxEntry =
  | { kind: 'inbox_item'; data: InboxItem }
  | { kind: 'task'; data: Task }

export interface TaskClassifyResult {
  areaId: string | null
  context: TaskContext | null
  energy: number | null
  timeEstimateMin: number | null
  rationale: string
  confidence: 'high' | 'medium' | 'low'
}

// =============================================================
// Hábitos + Rituais
// =============================================================

export type HabitCadence =
  | { type: 'daily' }
  | { type: 'weekdays' }
  | { type: 'weekly'; days: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[] }
  | { type: 'every_n_days'; n: number }
  | { type: 'monthly'; dayOfMonth: number }

export interface Habit {
  id: string
  userId: string
  areaId?: string
  identity: string
  title: string
  action: string
  minDose: string
  cue?: string
  reward?: string
  quadrant: Quadrant
  cadence: HabitCadence
  scheduleTime?: string
  stackAfterHabitId?: string
  active: boolean
  archivedAt?: string
  createdAt: string
  updatedAt: string
}

export interface HabitLog {
  id: string
  habitId: string
  userId: string
  doneOn: string
  doneAt: string
  dose: HabitDose
  note?: string
}

export interface HabitStreak {
  habitId: string
  currentStreak: number
  longestStreak: number
  doneToday: HabitDose | null
  rateLast30: number
}

export interface RitualStep {
  id?: string
  position: number
  habitId?: string
  customStep?: string
  estimatedMin?: number
}

export interface Ritual {
  id: string
  userId: string
  name: string
  triggerTime?: string
  description?: string
  active: boolean
  createdAt: string
  updatedAt: string
  steps: RitualStep[]
}

// =============================================================
// AI Coach
// =============================================================

export interface CoachProfile {
  userId: string
  name: string
  tone: string
  voiceExamples?: string
  valuesMd: string[]
  boundaries?: string
  checkInSchedule: {
    morning?: string
    evening?: string
    emailMorning?: boolean
    emailEvening?: boolean
    weeklyDay?: 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'
    weeklyTime?: string
  }
  systemPromptOverride?: string
  northStarMd?: string
  h3Goals: { title: string; horizon: 'H3'; targetDate?: string }[]
  updatedAt: string
}

export interface CoachMemoryEntry {
  id: string
  userId: string
  kind: MemoryKind
  content: string
  source?: string
  relatedAreaId?: string
  relatedProjectId?: string
  relatedTaskId?: string
  relevance: number
  expiresAt?: string
  lastReferencedAt?: string
  createdAt: string
}

export type CoachMessageDirection = 'user_to_coach' | 'coach_to_user'
export type CoachMessageKind = 'chat' | 'check_in' | 'callout' | 'celebration'

export interface CoachLogEntry {
  id: string
  direction: CoachMessageDirection
  kind: CoachMessageKind
  contentMd: string
  createdAt: string
}

export interface CoachMemoryCandidate {
  id: string
  kind: MemoryKind
  content: string
  relevance: number
  expiresAt?: string
  sourceLogId?: string
  createdAt: string
}

// =============================================================
// Carnegie (0014 base + 0015 rituais)
// =============================================================

export type SpecialDateType = 'celebrate' | 'acknowledge' | 'silence' | 'check_in'
export type SpecialDateSource = 'manual' | 'derived_first_met' | 'derived_company_start' | 'derived_birthday'

export interface SpecialDate {
  id: string
  userId: string
  contactId: string
  label: string
  type: SpecialDateType
  dateAnniversary?: string
  dateFull?: string
  recurring: boolean
  leadDays?: number
  silenceDays?: number
  privateNote?: string
  source: SpecialDateSource
  createdAt: string
  updatedAt: string
}

export type ReferralStatus = 'open' | 'closed' | 'dropped'

export interface Referral {
  id: string
  userId: string
  fromContactId: string
  toContactId?: string
  context: string
  outcomeNote?: string
  feedbackGiven: boolean
  feedbackGivenAt?: string
  status: ReferralStatus
  createdAt: string
  updatedAt: string
}

export interface Compliment {
  id: string
  userId: string
  contactId: string
  text: string
  receivedAt: string
  context?: string
  remindToReciprocateAt?: string
  reciprocated: boolean
  reciprocatedAt?: string
  reciprocationNote?: string
  createdAt: string
}

export interface PrincipleOfMonth {
  id: string
  userId: string
  principle: string
  month: string
  targetApplications: number
  reflection?: string
  createdAt: string
  updatedAt: string
}

export interface WeeklyReflection {
  id: string
  userId: string
  week: string
  markedMeContactId?: string
  markedMeWhy?: string
  letDownContactId?: string
  letDownWhy?: string
  reconnectContactId?: string
  reconnectHandled: boolean
  createdAt: string
}

export type GratitudeChannel = ContactChannel

export interface GratitudeEntry {
  id: string
  userId: string
  contactId?: string
  text: string
  shared: boolean
  sharedAt?: string
  sharedChannel?: GratitudeChannel
  createdAt: string
}

// =============================================================
// PR8 categories (0016)
// =============================================================

export type CategoryColor =
  | 'gray' | 'red' | 'orange' | 'yellow' | 'green'
  | 'teal' | 'blue' | 'purple' | 'pink' | 'accent'

export interface CategoryDimension {
  id: string
  label: string
  slug: string
  description?: string
  sortOrder: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  dimensionId: string
  dimensionLabel?: string
  dimensionSlug?: string
  label: string
  slug: string
  color?: CategoryColor
  description?: string
  sortOrder: number
  archived: boolean
  usageCount: number
}

export interface ContactFilter {
  search?: string
  tier?: ContactTier[]
  phase?: string[]
  categoryIds?: string[]
  hasPromisesOverdue?: boolean
  hasOpenReferrals?: boolean
  archived?: boolean
}

// =============================================================
// Módulo Hill (0019) — Chief Aim, Goals, Afirmações, Rituais
// =============================================================

export type HillGoalLevel = HillGoalLevelDB
export type HillGoalStatus = HillGoalStatusDB
export type AffirmationDimension = HillAffirmationDimensionDB
export type AffirmationStatus = HillAffirmationStatusDB
export type RitualType = HillRitualTypeDB

export interface ChiefAim {
  id: string
  userId: string
  aimText: string
  deadline: string
  exchangeText: string
  planText?: string
  isActive: boolean
  archivedAt?: string
  nextReview: string
  createdAt: string
  updatedAt: string
}

export interface HillGoal {
  id: string
  userId: string
  chiefAimId?: string
  parentId?: string
  level: HillGoalLevel
  title: string
  metricText?: string
  metricValue?: number
  metricUnit?: string
  progressPct: number
  deadline?: string
  status: HillGoalStatus
  linkedProjectId?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Affirmation {
  id: string
  userId: string
  chiefAimId: string
  dimension: AffirmationDimension
  text: string
  beliefScore: number
  derivedFrom?: { evidences: string[] }
  status: AffirmationStatus
  supersededBy?: string
  retiredReason?: string
  activeFrom: string
  activeUntil?: string
  createdAt: string
  updatedAt: string
}

export interface RitualReflection {
  what_brought_closer?: string
  what_pushed_away?: string
  next_action?: string
}

export interface RitualLog {
  id: string
  userId: string
  type: RitualType
  startedAt: string
  completedAt?: string
  durationSeconds?: number
  stepsCompleted: string[]
  affirmationsRead: string[]
  affirmationsSkipped: string[]
  reflectionData?: RitualReflection
  gratitudeItems?: string[]
  dailyActionTaskId?: string
  createdAt: string
}

export interface RitualTypeStats {
  completed: number
  adherencePct: number
  streak: number
}

export interface RitualStats {
  days: number
  morning: RitualTypeStats
  night: RitualTypeStats
}

/** As 5 dimensões da afirmação, na ordem canônica do wizard. */
export const AFFIRMATION_DIMENSIONS: {
  key: AffirmationDimension
  label: string
  prompt: string
}[] = [
  { key: 'identidade', label: 'Identidade', prompt: 'Quem eu sou — a identidade que escolho encarnar.' },
  { key: 'acao', label: 'Ação', prompt: 'O que eu faço todos os dias rumo ao meu Chief Aim.' },
  { key: 'capacidade', label: 'Capacidade', prompt: 'O que sou capaz de realizar — sustentado por evidências.' },
  { key: 'relacoes', label: 'Relações', prompt: 'Como me relaciono e o valor que entrego aos outros.' },
  { key: 'integracao', label: 'Integração', prompt: 'Como tudo se une no propósito maior.' },
]

export const AFFIRMATION_DIMENSION_LABELS: Record<AffirmationDimension, string> = {
  identidade: 'Identidade',
  acao: 'Ação',
  capacidade: 'Capacidade',
  relacoes: 'Relações',
  integracao: 'Integração',
}
