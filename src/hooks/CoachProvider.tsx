import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api.ts'
import { useAuth } from './useAuth.ts'
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

export interface SendOpts {
  onStart?: () => void
  onDelta: (text: string) => void
  onDone: (full: string) => void
  onError: (msg: string) => void
}

export interface CoachContextValue {
  profile: CoachProfile | null
  memories: CoachMemoryEntry[]
  messages: CoachLogEntry[]
  candidates: CoachMemoryCandidate[]
  unread: number
  loading: boolean
  sendMessage: (content: string, opts: SendOpts) => Promise<void>
  triggerExtract: () => Promise<void>
  acceptCandidate: (input: CoachMemoryAcceptInput) => Promise<void>
  dismissCandidate: (candidateId: string) => Promise<void>
  markRead: () => Promise<void>
  saveProfile: (input: CoachProfileSaveInput) => Promise<CoachProfile>
  saveMemory: (input: CoachMemorySaveInput) => Promise<CoachMemoryEntry>
  archiveMemory: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const CoachContext = createContext<CoachContextValue | null>(null)

const UNREAD_POLL_MS = 60_000

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<CoachProfile | null>(null)
  const [memories, setMemories] = useState<CoachMemoryEntry[]>([])
  const [messages, setMessages] = useState<CoachLogEntry[]>([])
  const [candidates, setCandidates] = useState<CoachMemoryCandidate[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const sendingRef = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!user) {
      setProfile(null); setMemories([]); setMessages([]); setCandidates([]); setUnread(0); setLoading(false)
      return
    }
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
      // silent — UI renders empty state
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      api.get<CoachUnreadResponse>('/api/coach-unread')
        .then(r => setUnread(prev => (prev === r.unread ? prev : r.unread)))
        .catch(() => {})
    }, UNREAD_POLL_MS)
    return () => clearInterval(id)
  }, [user])

  const sendMessage = useCallback(async (content: string, opts: SendOpts): Promise<void> => {
    if (sendingRef.current) return
    sendingRef.current = true
    const trimmed = content.trim()
    if (!trimmed) { sendingRef.current = false; return }

    const tempUserId = `temp-user-${Date.now()}`
    const tempCoachId = `temp-coach-${Date.now()}`
    const nowIso = new Date().toISOString()

    setMessages(prev => [
      ...prev,
      { id: tempUserId, direction: 'user_to_coach', kind: 'chat', contentMd: trimmed, createdAt: nowIso },
      { id: tempCoachId, direction: 'coach_to_user', kind: 'chat', contentMd: '', createdAt: nowIso },
    ])

    try {
      const res = await fetch('/api/coach-chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({ content: trimmed }),
      })
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => 'erro')
        setMessages(prev => prev.filter(m => m.id !== tempUserId && m.id !== tempCoachId))
        opts.onError(text)
        return
      }
      opts.onStart?.()

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let assembled = ''
      let realUserId: string | null = null

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
            const obj = JSON.parse(line.slice(6)) as {
              type: string; text?: string; message?: string;
              userMsgId?: string; coachMsgId?: string; coachCreatedAt?: string;
            }
            if (obj.type === 'start' && obj.userMsgId) {
              realUserId = obj.userMsgId
              setMessages(prev => prev.map(m =>
                m.id === tempUserId ? { ...m, id: obj.userMsgId! } : m
              ))
            } else if (obj.type === 'delta' && obj.text) {
              assembled += obj.text
              setMessages(prev => prev.map(m =>
                m.id === tempCoachId ? { ...m, contentMd: assembled } : m
              ))
              opts.onDelta(obj.text)
            } else if (obj.type === 'error') {
              opts.onError(obj.message ?? 'erro')
            } else if (obj.type === 'done') {
              if (obj.coachMsgId) {
                const newCoachId = obj.coachMsgId
                const newCreatedAt = obj.coachCreatedAt
                setMessages(prev => prev.map(m =>
                  m.id === tempCoachId
                    ? { ...m, id: newCoachId, contentMd: assembled, ...(newCreatedAt ? { createdAt: newCreatedAt } : {}) }
                    : m
                ))
              }
              opts.onDone(assembled)
            }
          } catch { /* ignore malformed events */ }
        }
      }

      // If the stream closed without a `done` event (network drop), drop the
      // partial optimistic placeholders — they aren't backed by real rows yet
      // unless `start` arrived (then user msg has the real id).
      setMessages(prev => prev.filter(m => {
        if (m.id === tempCoachId && !assembled) return false
        if (m.id === tempUserId && !realUserId) return false
        return true
      }))
    } finally {
      sendingRef.current = false
    }
  }, [])

  const triggerExtract = useCallback(async () => {
    try {
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
    const path = '/api/coach-memory-save'
    const res = input.id
      ? await api.patch<CoachMemorySaveResponse>(path, input)
      : await api.post<CoachMemorySaveResponse>(path, input)
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

  const value: CoachContextValue = {
    profile, memories, messages, candidates, unread, loading,
    sendMessage, triggerExtract, acceptCandidate, dismissCandidate, markRead,
    saveProfile, saveMemory, archiveMemory,
    refetch: fetchAll,
  }

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>
}
