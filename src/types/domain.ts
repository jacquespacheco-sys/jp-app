export type TaskStatus = 'inbox' | 'next' | 'doing' | 'blocked' | 'done'
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

export interface AuthUser {
  id: string
  email: string
  name: string
  timezone: string
  theme: string
}
