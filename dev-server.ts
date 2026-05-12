import express from 'express'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import authLogin from './api/auth-login.ts'
import authLogout from './api/auth-logout.ts'
import authMe from './api/auth-me.ts'
import projectsList from './api/projects-list.ts'
import projectsSave from './api/projects-save.ts'
import projectsArchive from './api/projects-archive.ts'
import projectsComplete from './api/projects-complete.ts'
import habitsList from './api/habits-list.ts'
import habitsSave from './api/habits-save.ts'
import habitsArchive from './api/habits-archive.ts'
import habitLogsSave from './api/habit-logs-save.ts'
import habitsStreaks from './api/habits-streaks.ts'
import ritualsList from './api/rituals-list.ts'
import ritualsSave from './api/rituals-save.ts'
import ritualsArchive from './api/rituals-archive.ts'
import coachProfile from './api/coach-profile.ts'
import coachMemoryList from './api/coach-memory-list.ts'
import coachMemorySave from './api/coach-memory-save.ts'
import coachMemoryArchive from './api/coach-memory-archive.ts'
import coachChat from './api/coach-chat.ts'
import coachChatHistory from './api/coach-chat-history.ts'
import coachUnread from './api/coach-unread.ts'
import coachMarkRead from './api/coach-mark-read.ts'
import coachMemoryExtract from './api/coach-memory-extract.ts'
import coachMemoryPending from './api/coach-memory-pending.ts'
import coachMemoryAccept from './api/coach-memory-accept.ts'
import coachMemoryDismiss from './api/coach-memory-dismiss.ts'
import coachCheckinCron from './api/coach-checkin-cron.ts'
import tasksList from './api/tasks-list.ts'
import tasksSave from './api/tasks-save.ts'
import tasksArchive from './api/tasks-archive.ts'
import tasksSync from './api/tasks-sync.ts'
import tasksClassify from './api/tasks-classify.ts'
import googleOauth from './api/google-oauth.ts'
import calendarsList from './api/calendars-list.ts'
import calendarsSync from './api/calendars-sync.ts'
import calendarsToggle from './api/calendars-toggle.ts'
import eventsSync from './api/events-sync.ts'
import eventsList from './api/events-list.ts'
import eventsSave from './api/events-save.ts'
import eventsDelete from './api/events-delete.ts'
import eventsParse from './api/events-parse.ts'
import briefingHistory from './api/briefing-history.ts'
import briefingGenerate from './api/briefing-generate.ts'
import sourcesList from './api/sources-list.ts'
import sourcesSave from './api/sources-save.ts'
import sourcesDelete from './api/sources-delete.ts'
import contactsList from './api/contacts-list.ts'
import contactsSave from './api/contacts-save.ts'
import contactsArchive from './api/contacts-archive.ts'
import contactsSync from './api/contacts-sync.ts'
import interactionsSave from './api/interactions-save.ts'
import interactionsList from './api/interactions-list.ts'
import areasList from './api/areas-list.ts'
import areasSave from './api/areas-save.ts'
import areasArchive from './api/areas-archive.ts'
import dashboardAqal from './api/dashboard-aqal.ts'
import inboxList from './api/inbox-list.ts'
import inboxCapture from './api/inbox-capture.ts'
import inboxProcess from './api/inbox-process.ts'
import newsList from './api/news-list.ts'
import newsFetch from './api/news-fetch.ts'
import newsFavorite from './api/news-favorite.ts'
import newsRead from './api/news-read.ts'
import noteFoldersList from './api/note-folders-list.ts'
import noteFoldersSave from './api/note-folders-save.ts'
import noteFoldersDelete from './api/note-folders-delete.ts'
import noteTagsList from './api/note-tags-list.ts'
import noteTagsSave from './api/note-tags-save.ts'
import noteTagsDelete from './api/note-tags-delete.ts'
import notesList from './api/notes-list.ts'
import notesSave from './api/notes-save.ts'
import notesDelete from './api/notes-delete.ts'
import notesUpload from './api/notes-upload.ts'

const app = express()
app.use(express.json({ limit: '10mb' }))

type Handler = (req: VercelRequest, res: VercelResponse) => unknown

function h(handler: Handler) {
  return (req: express.Request, res: express.Response) =>
    handler(req as unknown as VercelRequest, res as unknown as VercelResponse)
}

// Auth
app.all('/api/auth-login', h(authLogin))
app.all('/api/auth-logout', h(authLogout))
app.all('/api/auth-me', h(authMe))

// Tasks
app.all('/api/projects-list', h(projectsList))
app.all('/api/projects-save', h(projectsSave))
app.all('/api/projects-archive', h(projectsArchive))
app.all('/api/projects-complete', h(projectsComplete))

// Hábitos + Rituais
app.all('/api/habits-list', h(habitsList))
app.all('/api/habits-save', h(habitsSave))
app.all('/api/habits-archive', h(habitsArchive))
app.all('/api/habit-logs-save', h(habitLogsSave))
app.all('/api/habits-streaks', h(habitsStreaks))
app.all('/api/rituals-list', h(ritualsList))
app.all('/api/rituals-save', h(ritualsSave))
app.all('/api/rituals-archive', h(ritualsArchive))

// Coach
app.all('/api/coach-profile', h(coachProfile))
app.all('/api/coach-memory-list', h(coachMemoryList))
app.all('/api/coach-memory-save', h(coachMemorySave))
app.all('/api/coach-memory-archive', h(coachMemoryArchive))
app.all('/api/coach-chat', h(coachChat))
app.all('/api/coach-chat-history', h(coachChatHistory))
app.all('/api/coach-unread', h(coachUnread))
app.all('/api/coach-mark-read', h(coachMarkRead))
app.all('/api/coach-memory-extract', h(coachMemoryExtract))
app.all('/api/coach-memory-pending', h(coachMemoryPending))
app.all('/api/coach-memory-accept', h(coachMemoryAccept))
app.all('/api/coach-memory-dismiss', h(coachMemoryDismiss))
app.all('/api/coach-checkin-cron', h(coachCheckinCron))
app.all('/api/tasks-list', h(tasksList))
app.all('/api/tasks-save', h(tasksSave))
app.all('/api/tasks-archive', h(tasksArchive))
app.all('/api/tasks-sync', h(tasksSync))
app.all('/api/tasks-classify', h(tasksClassify))

// AQAL
app.all('/api/areas-list', h(areasList))
app.all('/api/areas-save', h(areasSave))
app.all('/api/areas-archive', h(areasArchive))
app.all('/api/dashboard-aqal', h(dashboardAqal))

// Inbox GTD
app.all('/api/inbox-list', h(inboxList))
app.all('/api/inbox-capture', h(inboxCapture))
app.all('/api/inbox-process', h(inboxProcess))

// Google OAuth
app.all('/api/google-oauth', h(googleOauth))

// Calendar
app.all('/api/calendars-list', h(calendarsList))
app.all('/api/calendars-sync', h(calendarsSync))
app.all('/api/calendars-toggle', h(calendarsToggle))
app.all('/api/events-sync', h(eventsSync))
app.all('/api/events-list', h(eventsList))
app.all('/api/events-save', h(eventsSave))
app.all('/api/events-delete', h(eventsDelete))
app.all('/api/events-parse', h(eventsParse))

// Briefing
app.all('/api/briefing-history', h(briefingHistory))
app.all('/api/briefing-generate', h(briefingGenerate))

// Sources / News
app.all('/api/sources-list', h(sourcesList))
app.all('/api/sources-save', h(sourcesSave))
app.all('/api/sources-delete', h(sourcesDelete))
app.all('/api/news-list', h(newsList))
app.all('/api/news-fetch', h(newsFetch))
app.all('/api/news-favorite', h(newsFavorite))
app.all('/api/news-read', h(newsRead))

// Contacts
app.all('/api/contacts-list', h(contactsList))
app.all('/api/contacts-save', h(contactsSave))
app.all('/api/contacts-archive', h(contactsArchive))
app.all('/api/contacts-sync', h(contactsSync))
app.all('/api/interactions-save', h(interactionsSave))
app.all('/api/interactions-list', h(interactionsList))

// Notes
app.all('/api/note-folders-list', h(noteFoldersList))
app.all('/api/note-folders-save', h(noteFoldersSave))
app.all('/api/note-folders-delete', h(noteFoldersDelete))
app.all('/api/note-tags-list', h(noteTagsList))
app.all('/api/note-tags-save', h(noteTagsSave))
app.all('/api/note-tags-delete', h(noteTagsDelete))
app.all('/api/notes-list', h(notesList))
app.all('/api/notes-save', h(notesSave))
app.all('/api/notes-delete', h(notesDelete))
app.all('/api/notes-upload', h(notesUpload))

app.listen(3001, () => {
  console.log('API server → http://localhost:3001')
  console.log('Routes: tasks, areas, inbox, calendar, briefing, news, contacts, notes')
})
