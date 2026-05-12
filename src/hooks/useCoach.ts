import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api.ts'
import type {
  CoachProfile, CoachMemoryEntry, CoachLogEntry, CoachMemoryCandidate,
} from '../types/domain.ts'
import type {
  CoachProfileResponse, CoachMemoryListResponse, CoachMemorySaveResponse,
  CoachChatHistoryResponse, CoachUnreadResponse,
  CoachMemoryPendingResponse, CoachMemoryAcceptResponse,
} from '../types/api.ts'
import type {
  CoachProfileSaveInput, CoachMemorySaveInput, CoachMemoryAcceptInput,
} from '../../api/_schemas/coach.ts'

interface SendOpts {
  onStart?: () => void
  onDelta: (text: string) => void
  onDone: (full: string) => void
  onError: (msg: string) => void
}

export function useCoach() {
  const [profile, setProfile] = useState<CoachProfile | null>(null)
  const [memories, setMemories] = useState<CoachMemoryEntry[]>([])
  const [messages, setMessages] = useState<CoachLogEntry[]>([])
  const [candidates, setCandidates] = useState<CoachMemoryCandidate[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const sendingRef = useRef(false)

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, mRes, hRes, candRes, uRes] = await Promise.all([
        api.get<CoachProfileResponse>('/api/coach-profile'),
        api.get<CoachMemoryListResponse>('/api/coach-memory-list'),
        api.get<CoachChatHistoryResponse>('/api/coach-chat-history?limit=100'),
        api.get<CoachMemoryPendingResponse>('/api/coach-memory-pending'),
        api.get<CoachUnreadResponse>('/api/coach-unread'),
      ])
      setProfile(pRes.profile)
      setMemories(mRes.memories)
      setMessages(hRes.messages)
      setCandidates(candRes.candidates)
      setUnread(uRes.unread)
    } catch {
      // silent — let UI render empty state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchAll() }, [fetchAll])

  // Poll unread every 60s
  useEffect(() => {
    const id = setInterval(() => {
      api.get<CoachUnreadResponse>('/api/coach-unread')
        .then(r => setUnread(r.unread))
        .catch(() => {})
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const sendMessage = useCallback(async (content: string, opts: SendOpts): Promise<void> => {
    if (sendingRef.current) return
    sendingRef.current = true
    try {
      const trimmed = content.trim()
      if (!trimmed) return

      const nowIso = new Date().toISOString()
      // optimistic user msg
      const tempUser: CoachLogEntry = {
        id: `temp-user-${Date.now()}`,
        direction: 'user_to_coach',
        kind: 'chat',
        contentMd: trimmed,
        createdAt: nowIso,
      }
      // optimistic coach skeleton
      const tempCoach: CoachLogEntry = {
        id: `temp-coach-${Date.now()}`,
        direction: 'coach_to_user',
        kind: 'chat',
        contentMd: '',
        createdAt: nowIso,
      }
      setMessages(prev => [...prev, tempUser, tempCoach])

      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => 'erro')
        setMessages(prev => prev.filter(m => m.id !== tempUser.id && m.id !== tempCoach.id))
        opts.onError(text)
        return
      }
      opts.onStart?.()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let assembled = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const events = buf.split('\n\n')
        buf = events.pop() ?? ''
        for (const e of events) {
          const line = e.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try {
            const obj = JSON.parse(line.slice(6)) as { type: string; text?: string; message?: string }
            if (obj.type === 'delta' && obj.text) {
              assembled += obj.text
              setMessages(prev => prev.map(m =>
                m.id === tempCoach.id ? { ...m, contentMd: assembled } : m
              ))
              opts.onDelta(obj.text)
            } else if (obj.type === 'error') {
              opts.onError(obj.message ?? 'erro')
            } else if (obj.type === 'done') {
              opts.onDone(assembled)
            }
          } catch { /* ignore */ }
        }
      }

      // refresh history (replaces temp IDs with real IDs)
      try {
        const h = await api.get<CoachChatHistoryResponse>('/api/coach-chat-history?limit=100')
        setMessages(h.messages)
      } catch { /* keep optimistic */ }
    } finally {
      sendingRef.current = false
    }
  }, [])

  const triggerExtract = useCallback(async () => {
    try {
      // find most recent real user msg id (skip temp- IDs)
      const lastUserMsg = [...messages].reverse().find(m =>
        m.direction === 'user_to_coach' && !m.id.startsWith('temp-')
      )
      const body = lastUserMsg ? { sinceLogId: lastUserMsg.id } : {}
      await api.post('/api/coach-memory-extract', body)
      const r = await api.get<CoachMemoryPendingResponse>('/api/coach-memory-pending')
      setCandidates(r.candidates)
    } catch { /* silent */ }
  }, [messages])

  const acceptCandidate = useCallback(async (input: CoachMemoryAcceptInput) => {
    const r = await api.post<CoachMemoryAcceptResponse>('/api/coach-memory-accept', input)
    setMemories(prev => [r.memory, ...prev])
    setCandidates(prev => prev.filter(c => c.id !== input.candidateId))
  }, [])

  const dismissCandidate = useCallback(async (candidateId: string) => {
    await api.post('/api/coach-memory-dismiss', { candidateId })
    setCandidates(prev => prev.filter(c => c.id !== candidateId))
  }, [])

  const markRead = useCallback(async () => {
    await api.post('/api/coach-mark-read')
    setUnread(0)
  }, [])

  const saveProfile = useCallback(async (input: CoachProfileSaveInput): Promise<CoachProfile> => {
    const res = await api.post<CoachProfileResponse>('/api/coach-profile', input)
    if (res.profile) setProfile(res.profile)
    return res.profile!
  }, [])

  const saveMemory = useCallback(async (input: CoachMemorySaveInput): Promise<CoachMemoryEntry> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<CoachMemorySaveResponse>('/api/coach-memory-save', input)
    setMemories(prev =>
      input.id
        ? prev.map(m => (m.id === res.memory.id ? res.memory : m))
        : [res.memory, ...prev]
    )
    return res.memory
  }, [])

  const archiveMemory = useCallback(async (id: string) => {
    await api.post('/api/coach-memory-archive', { id })
    setMemories(prev => prev.filter(m => m.id !== id))
  }, [])

  return {
    profile, memories, messages, candidates, unread, loading,
    sendMessage, triggerExtract, acceptCandidate, dismissCandidate, markRead,
    saveProfile, saveMemory, archiveMemory,
    refetch: fetchAll,
  }
}
