import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { ContactTier } from '../types/domain.ts'

export interface QueueItem {
  id: string
  firstName: string
  lastName: string | null
  company: string | null
  role: string | null
  tier: ContactTier | null
  phase: string | null
  tags: string[]
  lastInteractionAt: string | null
  interactionCount: number
  conversationHooks: string[]
  preferredChannel: string | null
  suggestedTier: ContactTier | null
}

export interface DunbarCounts {
  inner: number
  strong: number
  network: number
  weak: number
  dormant: number
}

export interface BulkClassifyUpdate {
  id: string
  tier?: ContactTier
  addHook?: string
  preferredChannel?: 'whatsapp' | 'email' | 'linkedin' | 'sms' | 'phone'
  linkedinUrl?: string
  cadenceDays?: number
  categoryIds?: string[]
}

export function useOnboardingQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [index, setIndex] = useState(0)
  const [totalRemaining, setTotalRemaining] = useState(0)
  const [counts, setCounts] = useState<DunbarCounts>({ inner: 0, strong: 0, network: 0, weak: 0, dormant: 0 })
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<{ items: QueueItem[]; totalRemaining: number; currentCounts: DunbarCounts }>(
        '/api/contacts-onboarding-queue?limit=50'
      )
      setItems(res.items)
      setTotalRemaining(res.totalRemaining)
      setCounts(res.currentCounts)
      setIndex(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const next = useCallback(() => {
    setIndex(i => Math.min(i + 1, items.length))
  }, [items.length])

  const prev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
  }, [])

  const classify = useCallback(async (update: BulkClassifyUpdate, advance = true) => {
    const item = items[index]
    if (!item) return
    const prevTier = item.tier

    setItems(prev => prev.map((it, i) => i === index
      ? {
          ...it,
          tier: update.tier ?? it.tier,
          conversationHooks: update.addHook && !it.conversationHooks.includes(update.addHook)
            ? [...it.conversationHooks, update.addHook]
            : it.conversationHooks,
          preferredChannel: update.preferredChannel ?? it.preferredChannel,
        }
      : it
    ))

    if (update.tier && update.tier !== prevTier) {
      setCounts(c => {
        const next = { ...c }
        if (prevTier && next[prevTier] > 0) next[prevTier] -= 1
        if (update.tier) next[update.tier] += 1
        return next
      })
    }

    await api.post('/api/contacts-bulk-classify', { updates: [update] })

    if (advance) next()
  }, [items, index, next])

  const skip = useCallback(() => {
    next()
  }, [next])

  const current = items[index] ?? null
  const done = index >= items.length

  return {
    items, current, index, total: items.length, totalRemaining, counts, loading, done,
    classify, skip, next, prev, refetch: fetch,
  }
}
