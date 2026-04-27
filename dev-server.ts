import express from 'express'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import authLogin from './api/auth-login.ts'
import authLogout from './api/auth-logout.ts'
import authMe from './api/auth-me.ts'
import projectsList from './api/projects-list.ts'
import tasksList from './api/tasks-list.ts'
import tasksSave from './api/tasks-save.ts'
import tasksArchive from './api/tasks-archive.ts'
import googleOauth from './api/google-oauth.ts'
import calendarsList from './api/calendars-list.ts'
import calendarsSync from './api/calendars-sync.ts'
import eventsSync from './api/events-sync.ts'
import eventsList from './api/events-list.ts'
import eventsSave from './api/events-save.ts'
import eventsDelete from './api/events-delete.ts'
import briefingHistory from './api/briefing-history.ts'
import briefingGenerate from './api/briefing-generate.ts'
import sourcesList from './api/sources-list.ts'
import sourcesSave from './api/sources-save.ts'
import sourcesDelete from './api/sources-delete.ts'
import calendarsToggle from './api/calendars-toggle.ts'
import contactsList from './api/contacts-list.ts'
import contactsSave from './api/contacts-save.ts'
import contactsArchive from './api/contacts-archive.ts'
import contactsSync from './api/contacts-sync.ts'
import interactionsSave from './api/interactions-save.ts'
import interactionsList from './api/interactions-list.ts'

const app = express()
app.use(express.json())

type Handler = (req: VercelRequest, res: VercelResponse) => unknown

function h(handler: Handler) {
  return (req: express.Request, res: express.Response) =>
    handler(req as unknown as VercelRequest, res as unknown as VercelResponse)
}

app.all('/api/auth-login', h(authLogin))
app.all('/api/auth-logout', h(authLogout))
app.all('/api/auth-me', h(authMe))
app.all('/api/projects-list', h(projectsList))
app.all('/api/tasks-list', h(tasksList))
app.all('/api/tasks-save', h(tasksSave))
app.all('/api/tasks-archive', h(tasksArchive))
app.all('/api/google-oauth', h(googleOauth))
app.all('/api/calendars-list', h(calendarsList))
app.all('/api/calendars-sync', h(calendarsSync))
app.all('/api/events-sync', h(eventsSync))
app.all('/api/events-list', h(eventsList))
app.all('/api/events-save', h(eventsSave))
app.all('/api/events-delete', h(eventsDelete))
app.all('/api/calendars-toggle', h(calendarsToggle))
app.all('/api/briefing-history', h(briefingHistory))
app.all('/api/briefing-generate', h(briefingGenerate))
app.all('/api/sources-list', h(sourcesList))
app.all('/api/sources-save', h(sourcesSave))
app.all('/api/sources-delete', h(sourcesDelete))
app.all('/api/contacts-list', h(contactsList))
app.all('/api/contacts-save', h(contactsSave))
app.all('/api/contacts-archive', h(contactsArchive))
app.all('/api/contacts-sync', h(contactsSync))
app.all('/api/interactions-save', h(interactionsSave))
app.all('/api/interactions-list', h(interactionsList))

app.listen(3001, () => {
  console.log('API server → http://localhost:3001')
})
