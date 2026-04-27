import './_env.js'
import { google } from 'googleapis'

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env['GOOGLE_CLIENT_ID'],
    process.env['GOOGLE_CLIENT_SECRET'],
    process.env['GOOGLE_REDIRECT_URI']
  )
}

export function getOAuthUrl(state: string) {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/directory.readonly',
    ],
    prompt: 'consent',
    state,
  })
}

export async function getAuthedClient(refreshToken: string) {
  const client = getOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

export const GOOGLE_COLORS: Record<string, string> = {
  '1': '#d50000', '2': '#e67c73', '3': '#f4511e', '4': '#f6bf26',
  '5': '#33b679', '6': '#0b8043', '7': '#039be5', '8': '#3f51b5',
  '9': '#7986cb', '10': '#8e24aa', '11': '#616161',
}
