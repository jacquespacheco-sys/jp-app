import { useState, useCallback } from 'react'
import { api } from '../api.ts'
import type { Note } from '../types/domain.ts'
import type { NoteSaveInput } from '../../api/_schemas/note.ts'

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async (params?: { folder?: string; type?: string; tag?: string; search?: string; archived?: boolean }) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (params?.folder) qs.set('folder', params.folder)
      if (params?.type) qs.set('type', params.type)
      if (params?.tag) qs.set('tag', params.tag)
      if (params?.search) qs.set('search', params.search)
      if (params?.archived) qs.set('archived', 'true')
      const data = await api.get<{ notes: Note[] }>(`/api/notes-list?${qs.toString()}`)
      setNotes(data.notes)
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (input: NoteSaveInput) => {
    const data = await api.post<{ note: Note }>('/api/notes-save', input)
    return data.note
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.post('/api/notes-delete', { id })
  }, [])

  const togglePin = useCallback(async (note: Note) => {
    await api.post('/api/notes-save', { id: note.id, type: note.type, content: note.content, pinned: !note.pinned })
  }, [])

  return { notes, loading, fetch, save, remove, togglePin }
}
