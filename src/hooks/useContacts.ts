import { useContext } from 'react'
import { ContactsContext } from './ContactsProvider.tsx'

export function useContacts() {
  const ctx = useContext(ContactsContext)
  if (!ctx) throw new Error('useContacts must be used within ContactsProvider')
  return ctx
}
