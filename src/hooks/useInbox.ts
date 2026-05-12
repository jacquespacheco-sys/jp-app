import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { InboxEntry, InboxItem } from '../types/domain.ts'
import type { InboxListResponse, InboxCaptureResponse, InboxProcessResponse } from '../types/api.ts'
import type { InboxProcessInput } from '../../api/_schemas/inbox.ts'

export function useInbox() {
  const [entries, setEntries] = useState<InboxEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<InboxListResponse>('/api/inbox-list')
      setEntries(res.entries)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const capture = useCallback(async (rawText: string): Promise<InboxItem> => {
    const res = await api.post<InboxCaptureResponse>('/api/inbox-capture', { rawText })
    setEntries(prev => [{ kind: 'inbox_item', data: res.item }, ...prev])
    return res.item
  }, [])

  const process = useCallback(async (input: InboxProcessInput) => {
    const res = await api.post<InboxProcessResponse>('/api/inbox-process', input)
    setEntries(prev => prev.filter(e => !(e.kind === 'inbox_item' && e.data.id === input.id)))
    return res
  }, [])

  return { entries, loading, fetch, capture, process }
}
