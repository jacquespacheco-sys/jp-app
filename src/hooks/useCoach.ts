import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { CoachProfile, CoachMemoryEntry } from '../types/domain.ts'
import type {
  CoachProfileResponse, CoachMemoryListResponse, CoachMemorySaveResponse,
} from '../types/api.ts'
import type {
  CoachProfileSaveInput, CoachMemorySaveInput,
} from '../../api/_schemas/coach.ts'

export function useCoach() {
  const [profile, setProfile] = useState<CoachProfile | null>(null)
  const [memories, setMemories] = useState<CoachMemoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const [pRes, mRes] = await Promise.all([
        api.get<CoachProfileResponse>('/api/coach-profile'),
        api.get<CoachMemoryListResponse>('/api/coach-memory-list'),
      ])
      setProfile(pRes.profile)
      setMemories(mRes.memories)
    } catch {
      setProfile(null)
      setMemories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

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

  return { profile, memories, loading, saveProfile, saveMemory, archiveMemory, refetch: fetch }
}
