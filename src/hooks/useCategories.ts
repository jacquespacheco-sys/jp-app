import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../api.ts'
import type { Category } from '../types/domain.ts'
import type { CategoriesListResponse, CategorySaveResponse } from '../types/api.ts'
import type { CategorySaveInput } from '../../api/_schemas/category.ts'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<CategoriesListResponse>('/api/categories-list')
      setCategories(res.categories)
    } catch {
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const byDimension = useMemo(() => {
    const bySlug = new Map<string, Category[]>()
    const byId = new Map<string, Category[]>()
    for (const c of categories) {
      if (c.dimensionSlug) {
        const arr = bySlug.get(c.dimensionSlug) ?? []
        arr.push(c)
        bySlug.set(c.dimensionSlug, arr)
      }
      const arr = byId.get(c.dimensionId) ?? []
      arr.push(c)
      byId.set(c.dimensionId, arr)
    }
    return (key: string) => bySlug.get(key) ?? byId.get(key) ?? []
  }, [categories])

  const save = useCallback(async (input: CategorySaveInput): Promise<Category> => {
    const res = await api.post<CategorySaveResponse>('/api/categories-save', input)
    setCategories(prev => input.id
      ? prev.map(c => c.id === res.category.id ? res.category : c)
      : [...prev, res.category].sort((a, b) => a.sortOrder - b.sortOrder)
    )
    return res.category
  }, [])

  const archive = useCallback(async (id: string, archived: boolean) => {
    await api.post('/api/categories-archive', { id, archived })
    if (archived) setCategories(prev => prev.filter(c => c.id !== id))
    else await fetch()
  }, [fetch])

  return { categories, loading, byDimension, save, archive, refetch: fetch }
}
