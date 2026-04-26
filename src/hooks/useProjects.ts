import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Project } from '../types/domain.ts'
import type { ProjectsListResponse } from '../types/api.ts'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<ProjectsListResponse>('/api/projects-list')
      setProjects(res.projects)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  return { projects, loading, refetch: fetch }
}
