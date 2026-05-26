import type { AuthUser, Task, Project, Contact, Interaction, CalendarEvent, Calendar, Briefing, Source, Newsletter } from './domain.ts'

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface LoginResponse {
  user: AuthUser
}

export interface MeResponse {
  user: AuthUser
}

export interface TasksListResponse {
  tasks: Task[]
}

export interface TaskSaveResponse {
  task: Task
}

export interface ProjectsListResponse {
  projects: Project[]
}

export interface ContactsListResponse {
  contacts: Contact[]
  googleConnected: boolean
}

export interface ContactSaveResponse {
  contact: Contact
}

export interface InteractionsListResponse {
  interactions: Interaction[]
}

export interface EventsListResponse {
  events: CalendarEvent[]
}

export interface EventSaveResponse {
  event: CalendarEvent
}

export interface CalendarsListResponse {
  calendars: Calendar[]
}

export interface BriefingResponse {
  briefing: Briefing
}

export interface BriefingHistoryResponse {
  briefings: Briefing[]
}

export interface SourcesListResponse {
  sources: Source[]
  newsletters: Newsletter[]
}

export interface SyncStatusResponse {
  tasks: { lastSync?: string; pending: number }
  calendar: { lastSync?: string; pending: number }
  contacts: { lastSync?: string; pending: number }
}

import type { Area, QuadrantAggregate, AreaAggregate, AqalTotals } from './domain.ts'

export interface AreasListResponse {
  areas: Area[]
}

export interface AreaSaveResponse {
  area: Area
}

export interface AqalDashboardResponse {
  byQuadrant: QuadrantAggregate[]
  byArea: AreaAggregate[]
  totals: AqalTotals
}

import type { InboxItem, InboxEntry, TaskClassifyResult } from './domain.ts'

export interface TaskClassifyResponse {
  classification: TaskClassifyResult
  task?: Task
}

export interface InboxListResponse {
  entries: InboxEntry[]
}

export interface InboxCaptureResponse {
  item: InboxItem
}

export interface InboxProcessResponse {
  item: InboxItem
  task?: Pick<Task, 'id' | 'title' | 'status'>
}

export interface ProjectSaveResponse {
  project: Project
}

import type { Habit, HabitLog, HabitStreak, Ritual } from './domain.ts'

export interface HabitsListResponse { habits: Habit[] }
export interface HabitSaveResponse { habit: Habit }
export interface HabitLogSaveResponse { log: HabitLog }
export interface HabitStreaksResponse { streaks: HabitStreak[] }
export interface RitualsListResponse { rituals: Ritual[] }
export interface RitualSaveResponse { ritual: Ritual }

import type { CoachProfile, CoachMemoryEntry, CoachLogEntry, CoachMemoryCandidate } from './domain.ts'

export interface CoachProfileResponse { profile: CoachProfile | null }
export interface CoachMemoryListResponse { memories: CoachMemoryEntry[] }
export interface CoachMemorySaveResponse { memory: CoachMemoryEntry }
export interface CoachChatHistoryResponse { messages: CoachLogEntry[] }
export interface CoachUnreadResponse { unread: number }
export interface CoachMemoryPendingResponse { candidates: CoachMemoryCandidate[] }
export interface CoachMemoryExtractResponse { candidates: CoachMemoryCandidate[] }
export interface CoachMemoryAcceptResponse { memory: CoachMemoryEntry }

import type {
  SpecialDate, Referral, Compliment,
  PrincipleOfMonth, WeeklyReflection, GratitudeEntry,
} from './domain.ts'

export interface SpecialDatesListResponse { specialDates: SpecialDate[] }
export interface SpecialDateSaveResponse { specialDate: SpecialDate }

export interface ReferralsListResponse { referrals: Referral[] }
export interface ReferralSaveResponse { referral: Referral }

export interface ComplimentsListResponse { compliments: Compliment[] }
export interface ComplimentSaveResponse { compliment: Compliment }

export interface PrincipleOfMonthListResponse { principles: PrincipleOfMonth[] }
export interface PrincipleOfMonthSaveResponse { principle: PrincipleOfMonth }
export interface PrincipleOfMonthCurrentResponse { principle: PrincipleOfMonth | null }

export interface WeeklyReflectionsListResponse { reflections: WeeklyReflection[] }
export interface WeeklyReflectionSaveResponse { reflection: WeeklyReflection }
export interface WeeklyReflectionCurrentResponse { reflection: WeeklyReflection | null }

export interface GratitudeEntriesListResponse { entries: GratitudeEntry[] }
export interface GratitudeEntrySaveResponse { entry: GratitudeEntry }

import type { CategoryDimension, Category } from './domain.ts'

export interface CategoryDimensionsListResponse { dimensions: CategoryDimension[] }
export interface CategoryDimensionSaveResponse { dimension: CategoryDimension }
export interface CategoriesListResponse { categories: Category[] }
export interface CategorySaveResponse { category: Category }
export interface ContactSetCategoriesResponse { contact: Contact | null }

import type { ChiefAim, HillGoal, Affirmation, RitualLog, RitualStats } from './domain.ts'

export interface ChiefAimResponse { chiefAim: ChiefAim | null }
export interface ChiefAimHistoryResponse { chiefAims: ChiefAim[] }
export interface AffirmationsListResponse { affirmations: Affirmation[] }
export interface AffirmationSaveResponse { affirmation: Affirmation }
export interface AffirmationsWizardResponse { affirmations: Affirmation[] }
export interface HillGoalsListResponse { goals: HillGoal[] }
export interface HillGoalSaveResponse { goal: HillGoal }
export interface RitualResponse { ritual: RitualLog; resumed?: boolean }
export interface RitualStatsResponse { stats: RitualStats }
export interface RitualHistoryResponse { rituals: RitualLog[] }

import type { HillCoachMessage, HillCoachConversation, HillPreferences, HillCoachAction, HillNudge } from './domain.ts'

export interface HillCoachConversationsResponse { conversations: HillCoachConversation[] }
export interface HillCoachMessagesResponse { messages: HillCoachMessage[] }
export interface HillCoachWizardStepResponse { content: string; action: HillCoachAction | null; conversationId: string }
export interface HillCoachMurmurResponse { content: string | null }
export interface HillPreferencesResponse { preferences: HillPreferences }
export interface HillNudgesResponse { nudges: HillNudge[] }

import type { QuarterlyReview, ReviewPending, AffirmationUsageStat } from './domain.ts'

export type ReviewPendingResponse = ReviewPending
export interface ReviewResponse { review: QuarterlyReview; resumed?: boolean }
export interface AffirmationUsageStatsResponse { stats: AffirmationUsageStat[]; windowDays: number }
