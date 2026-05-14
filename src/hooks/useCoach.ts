import { useContext } from 'react'
import { CoachContext, type CoachContextValue } from './CoachProvider.tsx'

export function useCoach(): CoachContextValue {
  const ctx = useContext(CoachContext)
  if (!ctx) throw new Error('useCoach must be used within CoachProvider')
  return ctx
}
