import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { NoteFolder } from '../types/domain.ts'
import type { NoteFolderSaveInput } from '../../api/_schemas/note.ts'

export function useNoteFolders() {
  const [folders, setFolders] = useState<NoteFolder[]>([])

  const fetch = useCallback(async () => {
    const data = await api.get<{ folders: NoteFolder[] }>('/api/note-folders-list')
    setFolders(data.folders)
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: NoteFolderSaveInput) => {
    await api.post('/api/note-folders-save', input)
    await fetch()
  }, [fetch])

  const remove = useCallback(async (id: string) => {
    await api.post('/api/note-folders-delete', { id })
    await fetch()
  }, [fetch])

  return { folders, fetch, save, remove }
}
