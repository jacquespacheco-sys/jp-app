import { useState, useCallback } from 'react'
import { api } from '../api.ts'
import type { NewsItem } from '../types/domain.ts'

export function useNews() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  const load = useCallback(async (params?: { source?: string; favorited?: boolean; offset?: number }) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (params?.source) qs.set('source', params.source)
      if (params?.favorited) qs.set('favorited', 'true')
      if (params?.offset) qs.set('offset', String(params.offset))
      const data = await api.get<{ items: NewsItem[] }>(`/api/news-list?${qs.toString()}`)
      setItems(data.items)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFeeds = useCallback(async () => {
    setFetching(true)
    try {
      await api.post('/api/news-fetch', {})
      await load()
    } finally {
      setFetching(false)
    }
  }, [load])

  const toggleFavorite = useCallback(async (item: NewsItem) => {
    await api.post('/api/news-favorite', { id: item.id, favorited: !item.favorited })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, favorited: !i.favorited } : i))
  }, [])

  const markRead = useCallback(async (id: string) => {
    await api.post('/api/news-read', { id })
    setItems(prev => prev.map(i => i.id === id ? { ...i, read: true } : i))
  }, [])

  return { items, loading, fetching, load, fetchFeeds, toggleFavorite, markRead }
}
