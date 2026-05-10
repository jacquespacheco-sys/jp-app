import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// New tables not in generated database.ts yet — see 0009_news.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const { source, favorited, limit = '50', offset = '0' } = req.query
  const limitNum = Number(limit)
  const offsetNum = Number(offset)
  let query = db().from('news_items').select('*').eq('user_id', user.id)
    .order('published_at', { ascending: false })
    .limit(limitNum).range(offsetNum, offsetNum + limitNum - 1)
  if (typeof source === 'string' && source) query = query.eq('source_id', source)
  if (favorited === 'true') query = query.eq('favorited', true)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: (error as { message: string }).message })
  const items = ((data ?? []) as Record<string, unknown>[]).map(r => ({
    id: r['id'], userId: r['user_id'],
    ...(r['source_id'] != null ? { sourceId: r['source_id'] } : {}),
    title: r['title'], url: r['url'],
    ...(r['summary'] != null ? { summary: r['summary'] } : {}),
    ...(r['content'] != null ? { content: r['content'] } : {}),
    ...(r['author'] != null ? { author: r['author'] } : {}),
    ...(r['image_url'] != null ? { imageUrl: r['image_url'] } : {}),
    publishedAt: r['published_at'], favorited: r['favorited'], read: r['read'],
    createdAt: r['created_at'],
  }))
  return res.status(200).json({ items })
}
