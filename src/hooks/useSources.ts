import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Source, Newsletter } from '../types/domain.ts'
import type { SourcesListResponse } from '../types/api.ts'

export function useSources() {
  const [sources, setSources] = useState<Source[]>([])
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get<SourcesListResponse>('/api/sources-list')
      setSources(res.sources)
      setNewsletters(res.newsletters)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const addSource = async (name: string, url: string) => {
    await api.post('/api/sources-save', { type: 'source', name, url, active: true })
    await load()
  }

  const toggleSource = async (s: Source) => {
    await api.post('/api/sources-save', { type: 'source', id: s.id, name: s.name, url: s.url, active: !s.active })
    setSources(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x))
  }

  const deleteSource = async (id: string) => {
    await api.delete('/api/sources-delete', { type: 'source', id })
    setSources(prev => prev.filter(s => s.id !== id))
  }

  return { sources, newsletters, loading, addSource, toggleSource, deleteSource }
}
