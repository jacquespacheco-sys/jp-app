import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseQuery, applyQuery, hasFilter } from './taskQueryParser.ts'

const FIXED_DATE = new Date('2026-05-14T12:00:00Z')

describe('parseQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })
  afterEach(() => { vi.useRealTimers() })

  it('parses date range "vencimento entre DD/MM e DD/MM"', () => {
    const r = parseQuery('vencimento entre 20/05 e 27/05')
    expect(r.dueDateFrom).toBe('2026-05-20')
    expect(r.dueDateTo).toBe('2026-05-27')
  })

  it('parses single due date "vence amanhã"', () => {
    const r = parseQuery('vence amanhã')
    expect(r.dueDateFrom).toBe('2026-05-15')
    expect(r.dueDateTo).toBe('2026-05-15')
  })

  it('extracts project from query', () => {
    const r = parseQuery('tasks projeto STATE')
    expect(r.projectName).toBe('STATE')
  })

  it('extracts status concluído', () => {
    const r = parseQuery('tasks concluídas')
    expect(r.status).toBe('done')
  })

  it('extracts priority urgente', () => {
    const r = parseQuery('tarefas urgentes')
    expect(r.priority).toBe('high')
  })

  it('combines range + project', () => {
    const r = parseQuery('tasks com vencimento entre 20 e 27/05, projeto STATE')
    expect(r.dueDateFrom).toBe('2026-05-20')
    expect(r.dueDateTo).toBe('2026-05-27')
    expect(r.projectName).toBe('STATE')
  })

  it('residual text remains for fuzzy match', () => {
    const r = parseQuery('relatório projeto STATE')
    expect(r.text).toBe('relatório')
    expect(r.projectName).toBe('STATE')
  })
})

describe('hasFilter', () => {
  it('false for empty query', () => {
    expect(hasFilter(parseQuery(''))).toBe(false)
  })

  it('true for any extracted filter', () => {
    expect(hasFilter(parseQuery('vence hoje'))).toBe(true)
    expect(hasFilter(parseQuery('foo'))).toBe(true)
  })
})

describe('applyQuery', () => {
  const projects = [
    { id: 'p1', name: 'STATE Innovation' },
    { id: 'p2', name: 'JP App' },
  ]
  const areas = [{ id: 'a1', name: 'Saúde' }]

  const tasks = [
    { id: 't1', title: 'Deploy backend', projectId: 'p1', tags: ['devops'], status: 'next', dueDate: '2026-05-22' },
    { id: 't2', title: 'Ligar para João', projectId: 'p2', tags: [], status: 'next', dueDate: '2026-05-15' },
    { id: 't3', title: 'Treino', projectId: 'p1', areaId: 'a1', tags: [], status: 'done', dueDate: '2026-05-10' },
  ]

  it('filters by project name', () => {
    const q = parseQuery('projeto STATE')
    const r = applyQuery(tasks, q, { projects, areas })
    expect(r.map(t => t.id)).toEqual(['t1', 't3'])
  })

  it('filters by due range', () => {
    const q = parseQuery('vencimento entre 20/05 e 25/05')
    const r = applyQuery(tasks, q, { projects, areas })
    expect(r.map(t => t.id)).toEqual(['t1'])
  })

  it('combines project + date range', () => {
    const q = parseQuery('projeto STATE vencimento entre 14 e 22/05')
    const r = applyQuery(tasks, q, { projects, areas })
    expect(r.map(t => t.id)).toEqual(['t1'])
  })

  it('full-text matches title', () => {
    const q = parseQuery('joão')
    const r = applyQuery(tasks, q, { projects, areas })
    expect(r.map(t => t.id)).toEqual(['t2'])
  })
})
