import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Contact } from '../types/domain.ts'
import type { ContactsListResponse, ContactSaveResponse } from '../types/api.ts'
import type { ContactSaveInput } from '../../api/_schemas/contact.ts'

interface ContactsState {
  contacts: Contact[]
  googleConnected: boolean
  loading: boolean
}

export function useContacts() {
  const [state, setState] = useState<ContactsState>({ contacts: [], googleConnected: false, loading: true })

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<ContactsListResponse>('/api/contacts-list')
      setState({ contacts: res.contacts, googleConnected: res.googleConnected, loading: false })
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: ContactSaveInput): Promise<Contact> => {
    const res = await api.post<ContactSaveResponse>('/api/contacts-save', input)
    await fetch()
    return res.contact
  }, [fetch])

  const archive = useCallback(async (id: string, archived: boolean) => {
    await api.post('/api/contacts-archive', { id, archived })
    await fetch()
  }, [fetch])

  const sync = useCallback(async () => {
    await api.post('/api/contacts-sync')
    await fetch()
  }, [fetch])

  return { ...state, save, archive, sync, refetch: fetch }
}
