import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { CategoryDimension } from '../types/domain.ts'
import type { CategoryDimensionsListResponse, CategoryDimensionSaveResponse } from '../types/api.ts'
import type { CategoryDimensionSaveInput } from '../../api/_schemas/category-dimension.ts'

export function useCategoryDimensions() {
  const [dimensions, setDimensions] = useState<CategoryDimension[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<CategoryDimensionsListResponse>('/api/category-dimensions-list')
      setDimensions(res.dimensions)
    } catch {
      setDimensions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: CategoryDimensionSaveInput): Promise<CategoryDimension> => {
    const res = await api.post<CategoryDimensionSaveResponse>('/api/category-dimensions-save', input)
    setDimensions(prev => input.id
      ? prev.map(d => d.id === res.dimension.id ? res.dimension : d)
      : [...prev, res.dimension].sort((a, b) => a.sortOrder - b.sortOrder)
    )
    return res.dimension
  }, [])

  const archive = useCallback(async (id: string, archived: boolean) => {
    await api.post('/api/category-dimensions-archive', { id, archived })
    if (archived) setDimensions(prev => prev.filter(d => d.id !== id))
    else await fetch()
  }, [fetch])

  return { dimensions, loading, save, archive, refetch: fetch }
}
