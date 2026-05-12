import { describe, it, expect } from 'vitest'
import { InboxCaptureSchema, InboxProcessSchema } from './inbox.js'

describe('InboxCaptureSchema', () => {
  it('aceita rawText obrigatório', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: 'capture this' }).success).toBe(true)
  })

  it('rejeita rawText vazio', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: '' }).success).toBe(false)
  })

  it('rejeita rawText acima de 2000 chars', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: 'x'.repeat(2001) }).success).toBe(false)
  })

  it('source default é manual', () => {
    const r = InboxCaptureSchema.safeParse({ rawText: 'x' })
    if (r.success) expect(r.data.source).toBe('manual')
  })

  it('aceita source válido', () => {
    for (const s of ['manual','voice','email','briefing','coach','google'] as const) {
      expect(InboxCaptureSchema.safeParse({ rawText: 'x', source: s }).success).toBe(true)
    }
  })

  it('aceita externalRef opcional', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: 'x', externalRef: 'gmail:abc123' }).success).toBe(true)
  })
})

describe('InboxProcessSchema', () => {
  const baseId = '00000000-0000-0000-0000-000000000010'
  const projectId = '00000000-0000-0000-0000-000000000020'

  it('aceita action=trash sem taskFields', () => {
    expect(InboxProcessSchema.safeParse({ id: baseId, action: 'trash' }).success).toBe(true)
  })

  it('aceita action=to_task com taskFields mínimo', () => {
    expect(InboxProcessSchema.safeParse({
      id: baseId,
      action: 'to_task',
      taskFields: { title: 'Task', projectId },
    }).success).toBe(true)
  })

  it('aceita action=to_project sem taskFields', () => {
    expect(InboxProcessSchema.safeParse({ id: baseId, action: 'to_project' }).success).toBe(true)
  })

  it('rejeita action inválida', () => {
    expect(InboxProcessSchema.safeParse({ id: baseId, action: 'archive' }).success).toBe(false)
  })

  it('taskFields aceita campos AQAL opcionais', () => {
    expect(InboxProcessSchema.safeParse({
      id: baseId,
      action: 'to_task',
      taskFields: {
        title: 'Task',
        projectId,
        areaId: '00000000-0000-0000-0000-000000000030',
        context: 'deep',
        energy: 4,
        timeEstimateMin: 60,
      },
    }).success).toBe(true)
  })
})
