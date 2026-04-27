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
