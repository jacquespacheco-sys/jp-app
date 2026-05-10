import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import Parser from 'rss-parser'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// news_items table not in generated database.ts yet — see 0009_news.sql migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return getSupabase() }

const parser = new Parser()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = requireAuth(req, res)
  if (!user) return
  const supabase = db()
  const { data: sources } = await supabase.from('sources').select('*').eq('user_id', user.id).eq('active', true)
  if (!sources?.length) return res.status(200).json({ fetched: 0 })
  const now = new Date().toISOString()
  let total = 0
  for (const src of sources as Record<string, unknown>[]) {
    try {
      const feed = await parser.parseURL(src['url'] as string)
      const items = (feed.items ?? []).slice(0, 30).map(item => ({
        user_id: user.id,
        source_id: src['id'] as string,
        title: item.title ?? '(sem título)',
        url: item.link ?? '',
        summary: item.contentSnippet ?? null,
        content: item.content ?? null,
        author: item.creator ?? null,
        image_url: (item.enclosure?.url) ?? null,
        published_at: item.isoDate ?? now,
      })).filter(i => i.url)
      if (items.length > 0) {
        const { error } = await supabase.from('news_items').upsert(items, {
          onConflict: 'user_id,url', ignoreDuplicates: true,
        })
        if (!error) total += items.length
      }
      await supabase.from('sources').update({ last_fetch: now }).eq('id', src['id'] as string)
    } catch (e) {
      console.error('[news-fetch] failed for source', src['name'], e instanceof Error ? e.message : e)
    }
  }
  return res.status(200).json({ fetched: total })
}
