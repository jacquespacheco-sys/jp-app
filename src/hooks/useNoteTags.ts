import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { NoteTag } from '../types/domain.ts'
import type { NoteTagSaveInput } from '../../api/_schemas/note.ts'

export function useNoteTags() {
  const [tags, setTags] = useState<NoteTag[]>([])

  const fetch = useCallback(async () => {
    const data = await api.get<{ tags: NoteTag[] }>('/api/note-tags-list')
    setTags(data.tags)
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: NoteTagSaveInput) => {
    await api.post('/api/note-tags-save', input)
    await fetch()
  }, [fetch])

  const remove = useCallback(async (id: string) => {
    await api.post('/api/note-tags-delete', { id })
    setTags(t => t.filter(x => x.id !== id))
  }, [])

  return { tags, fetch, save, remove }
}
