import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { mapGoal } from './_hill.js'
import type { HillGoalLevel, HillGoalStatus } from '../src/types/database.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const LEVELS: HillGoalLevel[] = ['dream', 'goal', 'quarterly']
const STATUSES: HillGoalStatus[] = ['active', 'completed', 'archived', 'failed']

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()
  const level = asString(req.query['level'])
  const status = asString(req.query['status'])

  let query = supabase.from('hill_goals').select('*').eq('user_id', user.id)
  if (level && (LEVELS as string[]).includes(level)) query = query.eq('level', level as HillGoalLevel)
  if (status && (STATUSES as string[]).includes(status)) query = query.eq('status', status as HillGoalStatus)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ goals: (data ?? []).map(mapGoal) })
}
