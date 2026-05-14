import { createContext, useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import { useAuth } from './useAuth.ts'
import type { Contact } from '../types/domain.ts'
import type { ContactsListResponse, ContactSaveResponse, ContactSetCategoriesResponse } from '../types/api.ts'
import type { ContactSaveInput } from '../../api/_schemas/contact.ts'

export interface ContactsContextValue {
  contacts: Contact[]
  googleConnected: boolean
  loading: boolean
  save: (input: ContactSaveInput) => Promise<Contact>
  archive: (id: string, archived: boolean) => Promise<void>
  sync: () => Promise<void>
  setContactCategories: (contactId: string, categoryIds: string[]) => Promise<Contact | null>
  refetch: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const ContactsContext = createContext<ContactsContextValue | null>(null)

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [googleConnected, setGoogleConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!user) {
      setContacts([]); setGoogleConnected(false); setLoading(false)
      return
    }
    try {
      const res = await api.get<ContactsListResponse>('/api/contacts-list')
      setContacts(res.contacts)
      setGoogleConnected(res.googleConnected)
    } catch {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void fetchAll() }, [fetchAll])

  const save = useCallback(async (input: ContactSaveInput): Promise<Contact> => {
    const res = await api.post<ContactSaveResponse>('/api/contacts-save', input)
    setContacts(prev => input.id
      ? prev.map(c => c.id === res.contact.id ? res.contact : c)
      : [...prev, res.contact].sort((a, b) => a.firstName.localeCompare(b.firstName))
    )
    return res.contact
  }, [])

  const archive = useCallback(async (id: string, archived: boolean) => {
    await api.post('/api/contacts-archive', { id, archived })
    if (archived) {
      setContacts(prev => prev.filter(c => c.id !== id))
    } else {
      await fetchAll()
    }
  }, [fetchAll])

  const sync = useCallback(async () => {
    await api.post('/api/contacts-sync')
    await fetchAll()
  }, [fetchAll])

  const setContactCategories = useCallback(async (contactId: string, categoryIds: string[]): Promise<Contact | null> => {
    const res = await api.post<ContactSetCategoriesResponse>('/api/contacts-set-categories', { contactId, categoryIds })
    if (res.contact) {
      const updated = res.contact
      setContacts(prev => prev.map(c => c.id === updated.id
        ? { ...c, ...(updated.categories != null ? { categories: updated.categories } : {}) }
        : c
      ))
    }
    return res.contact
  }, [])

  const value: ContactsContextValue = {
    contacts, googleConnected, loading,
    save, archive, sync, setContactCategories, refetch: fetchAll,
  }

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>
}
