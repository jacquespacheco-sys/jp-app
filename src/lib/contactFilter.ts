import type { Contact, ContactFilter } from '../types/domain.ts'

export function matchesContactFilter(
  contact: Contact,
  filter: ContactFilter | undefined,
  catDimMap: Map<string, string>,
): boolean {
  if (!filter) return true
  if (filter.tier?.length && (!contact.tier || !filter.tier.includes(contact.tier))) return false
  if (filter.phase?.length && (!contact.phase || !filter.phase.includes(contact.phase))) return false

  if (filter.categoryIds?.length) {
    const groups = new Map<string, Set<string>>()
    for (const cid of filter.categoryIds) {
      const dimId = catDimMap.get(cid) ?? '_unknown'
      const set = groups.get(dimId) ?? new Set<string>()
      set.add(cid)
      groups.set(dimId, set)
    }
    const ids = new Set((contact.categories ?? []).map(c => c.id))
    for (const group of groups.values()) {
      if (![...group].some(id => ids.has(id))) return false
    }
  }
  return true
}

export function applyContactFilter(
  contacts: Contact[],
  filter: ContactFilter | undefined,
  catDimMap: Map<string, string>,
): Contact[] {
  if (!filter || (!filter.tier?.length && !filter.phase?.length && !filter.categoryIds?.length)) {
    return contacts
  }
  return contacts.filter(c => matchesContactFilter(c, filter, catDimMap))
}
