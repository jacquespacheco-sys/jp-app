import type {
  Quadrant as QuadrantDB, HorizonLvl as HorizonLvlDB,
  TaskContext as TaskContextDB, ProjectKind as ProjectKindDB,
  ProjectStatusAqal, HabitDose as HabitDoseDB,
  MemoryKind as MemoryKindDB, CaptureSrc as CaptureSrcDB,
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

export interface Interaction {
  id: string
  contactId: string
  date: string
  type: 'call' | 'meeting' | 'email' | 'message'
  note: string
  createdAt: string
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

export const QUADRANT_COLORS: Record<Quadrant, string> = {
  I: '#a78bfa',
  IT: '#34d399',
  WE: '#fb923c',
  ITS: '#60a5fa',
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
