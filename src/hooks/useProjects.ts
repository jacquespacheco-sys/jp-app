import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Project } from '../types/domain.ts'
import type { ProjectsListResponse, ProjectSaveResponse } from '../types/api.ts'
import type { ProjectSaveInput } from '../../api/_schemas/project.ts'

interface Opts {
  includeArchived?: boolean
  status?: 'active' | 'on_hold' | 'someday' | 'done'
}

export function useProjects(opts?: Opts) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (opts?.includeArchived) params.set('status', 'archived')
      else if (opts?.status) params.set('status', opts.status)
      const q = params.toString() ? `?${params.toString()}` : ''
      const res = await api.get<ProjectsListResponse>(`/api/projects-list${q}`)
      setProjects(res.projects)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [opts?.includeArchived, opts?.status])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: ProjectSaveInput): Promise<Project> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<ProjectSaveResponse>('/api/projects-save', input)
    setProjects(prev =>
      input.id
        ? prev.map(p => (p.id === res.project.id ? res.project : p))
        : [...prev, res.project]
    )
    return res.project
  }, [])

  const archive = useCallback(async (id: string) => {
    await api.post('/api/projects-archive', { id })
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  const complete = useCallback(async (id: string) => {
    const res = await api.post<ProjectSaveResponse>('/api/projects-complete', { id })
    setProjects(prev => prev.map(p => (p.id === res.project.id ? res.project : p)))
    return res.project
  }, [])

  return { projects, loading, save, archive, complete, refetch: fetch }
}
