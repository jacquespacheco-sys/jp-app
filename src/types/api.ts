import type { AuthUser, Task, Project, Contact, CalendarEvent, Calendar, Briefing } from './domain.ts'

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

export interface SyncStatusResponse {
  tasks: { lastSync?: string; pending: number }
  calendar: { lastSync?: string; pending: number }
  contacts: { lastSync?: string; pending: number }
}
