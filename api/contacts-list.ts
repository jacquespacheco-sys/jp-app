import { requireAuth } from './_middleware.ts'
import { getSupabase } from './_supabase.ts'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapContact(c: Record<string, unknown>) {
  return {
    id: c['id'], userId: c['user_id'],
    firstName: c['first_name'], lastName: c['last_name'] ?? undefined,
    company: c['company'] ?? undefined, role: c['role'] ?? undefined,
    email: c['email'] ?? undefined, phone: c['phone'] ?? undefined,
    address: c['address'] ?? undefined, birthday: c['birthday'] ?? undefined,
    tags: (c['tags'] as string[]) ?? [],
    phase: c['phase'] ?? undefined, nextContact: c['next_contact'] ?? undefined,
    notes: (c['notes'] as string) ?? '',
    googleContactId: c['google_contact_id'] ?? undefined,
    synced: c['synced'], archived: c['archived'],
    archivedAt: c['archived_at'] ?? undefined,
    createdAt: c['created_at'], updatedAt: c['updated_at'],
  }
}

export { mapContact }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const [{ data, error }, { data: userData }] = await Promise.all([
    supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('first_name', { ascending: true }),
    supabase
      .from('users')
      .select('google_refresh_token')
      .eq('id', user.id)
      .single(),
  ])

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({
    googleConnected: !!userData?.google_refresh_token,
    contacts: (data ?? []).map(c => mapContact(c as Record<string, unknown>)),
  })
}
