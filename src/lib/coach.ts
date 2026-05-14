import type { MemoryKind } from '../types/domain.ts'

export const COACH_KIND_LABEL: Record<MemoryKind, string> = {
  fact: 'fato',
  pattern: 'padrão',
  promise: 'promessa',
  concern: 'preocupação',
  preference: 'preferência',
}
