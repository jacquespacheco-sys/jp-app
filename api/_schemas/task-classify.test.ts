import { describe, it, expect } from 'vitest'
import { TaskClassifyRequestSchema, TaskClassifyResponseSchema } from './task-classify.js'

const uuid = '00000000-0000-0000-0000-000000000001'

describe('TaskClassifyRequestSchema', () => {
  it('aceita { taskId }', () => {
    expect(TaskClassifyRequestSchema.safeParse({ taskId: uuid }).success).toBe(true)
  })

  it('aceita { inboxItemId }', () => {
    expect(TaskClassifyRequestSchema.safeParse({ inboxItemId: uuid }).success).toBe(true)
  })

  it('rejeita corpo vazio', () => {
    expect(TaskClassifyRequestSchema.safeParse({}).success).toBe(false)
  })

  it('rejeita id que não é UUID', () => {
    expect(TaskClassifyRequestSchema.safeParse({ taskId: 'abc' }).success).toBe(false)
  })
})

describe('TaskClassifyResponseSchema', () => {
  const valid = {
    areaId: uuid,
    context: 'deep',
    energy: 4,
    timeEstimateMin: 90,
    rationale: 'tarefa cognitiva pesada relacionada a STATE',
    confidence: 'high',
  }

  it('aceita resposta completa', () => {
    expect(TaskClassifyResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('aceita campos null (Haiku indeciso)', () => {
    expect(TaskClassifyResponseSchema.safeParse({
      ...valid,
      areaId: null,
      context: null,
      energy: null,
      timeEstimateMin: null,
    }).success).toBe(true)
  })

  it('aceita confidence=medium e low', () => {
    for (const c of ['medium','low'] as const) {
      expect(TaskClassifyResponseSchema.safeParse({ ...valid, confidence: c }).success).toBe(true)
    }
  })

  it('rejeita confidence inválida', () => {
    expect(TaskClassifyResponseSchema.safeParse({ ...valid, confidence: 'sure' }).success).toBe(false)
  })

  it('rejeita context fora do enum', () => {
    expect(TaskClassifyResponseSchema.safeParse({ ...valid, context: 'meeting' }).success).toBe(false)
  })

  it('exige rationale string', () => {
    const { rationale: _r, ...rest } = valid
    expect(TaskClassifyResponseSchema.safeParse(rest).success).toBe(false)
  })
})
