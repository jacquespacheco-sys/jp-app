import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Task, TaskClassifyResult } from '../types/domain.ts'
import type { TasksListResponse, TaskSaveResponse, TaskClassifyResponse } from '../types/api.ts'
import type { TaskSaveInput } from '../../api/_schemas/task.ts'

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<TasksListResponse>('/api/tasks-list')
      setTasks(res.tasks as Task[])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: TaskSaveInput): Promise<Task> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<TaskSaveResponse>('/api/tasks-save', input)
    const task = res.task as Task
    setTasks(prev =>
      input.id
        ? prev.map(t => (t.id === task.id ? task : t))
        : [task, ...prev]
    )
    return task
  }, [])

  const archive = useCallback(async (id: string) => {
    await api.patch('/api/tasks-archive', { id })
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const updateStatus = useCallback(async (id: string, status: Task['status']) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, status } : t)))
    try {
      await save({ ...task, id: task.id, projectId: task.projectId, status })
    } catch (e) {
      setTasks(prev => prev.map(t => (t.id === id ? task : t)))
      throw e
    }
  }, [tasks, save])

  const classify = useCallback(async (taskId: string): Promise<TaskClassifyResult> => {
    const res = await api.post<TaskClassifyResponse>('/api/tasks-classify', { taskId })
    if (res.task) {
      const updated = res.task as Task
      setTasks(prev => prev.map(t => (t.id === updated.id ? updated : t)))
    }
    return res.classification
  }, [])

  return { tasks, loading, save, archive, updateStatus, classify, refetch: fetch }
}
