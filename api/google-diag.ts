import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// DIAGNÓSTICO TEMPORÁRIO — remover depois de investigar o push pro Google.
// Mostra os escopos concedidos no token e testa uma escrita real em Tasks e
// People (cria + apaga um item temporário), retornando o erro exato se falhar.
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const { data: u } = await supabase
    .from('users')
    .select('google_refresh_token')
    .eq('id', user.id)
    .single()

  const out: Record<string, unknown> = { refreshToken: !!u?.google_refresh_token }
  if (!u?.google_refresh_token) return res.status(200).json(out)

  const authClient = await getAuthedClient(u.google_refresh_token)

  try {
    const at = await authClient.getAccessToken()
    out['gotAccessToken'] = !!at?.token
    if (at?.token) {
      const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${at.token}`).then(r => r.json())
      out['scopes'] = (info as { scope?: string }).scope ?? info
    }
  } catch (e) {
    out['tokenError'] = msg(e)
  }

  try {
    const tasksApi = google.tasks({ version: 'v1', auth: authClient })
    const { data: list } = await tasksApi.tasklists.insert({ requestBody: { title: 'JP_DIAG_DELETE_ME' } })
    out['tasksWrite'] = 'OK'
    if (list?.id) await tasksApi.tasklists.delete({ tasklist: list.id }).catch(() => {})
  } catch (e) {
    out['tasksWrite'] = msg(e)
  }

  try {
    const peopleApi = google.people({ version: 'v1', auth: authClient })
    const { data: c } = await peopleApi.people.createContact({ requestBody: { names: [{ givenName: 'JP_DIAG_DELETE_ME' }] } })
    out['contactsWrite'] = 'OK'
    if (c?.resourceName) await peopleApi.people.deleteContact({ resourceName: c.resourceName }).catch(() => {})
  } catch (e) {
    out['contactsWrite'] = msg(e)
  }

  return res.status(200).json(out)
}
