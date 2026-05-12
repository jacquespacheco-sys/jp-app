import { describe, it, expect } from 'vitest'
import { ProjectSaveSchema, ProjectArchiveSchema, ProjectCompleteSchema } from './project.js'

const baseValid = { name: 'P1' }

describe('ProjectSaveSchema', () => {
  describe('name', () => {
    it('aceita name não-vazio', () => {
      expect(ProjectSaveSchema.safeParse(baseValid).success).toBe(true)
    })
    it('rejeita name vazio', () => {
      expect(ProjectSaveSchema.safeParse({ name: '' }).success).toBe(false)
    })
    it('rejeita name acima de 200 chars', () => {
      expect(ProjectSaveSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false)
    })
  })

  describe('color', () => {
    it('default é #7dd3fc', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.color).toBe('#7dd3fc')
    })
    it('aceita hex válido', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, color: '#abc' }).success).toBe(true)
    })
    it('rejeita string sem #', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, color: 'red' }).success).toBe(false)
    })
  })

  describe('kind', () => {
    it('default é outcome', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.kind).toBe('outcome')
    })
    it('aceita outcome e evergreen', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, kind: 'outcome' }).success).toBe(true)
      expect(ProjectSaveSchema.safeParse({ ...baseValid, kind: 'evergreen' }).success).toBe(true)
    })
    it('rejeita outros valores', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, kind: 'project' }).success).toBe(false)
    })
  })

  describe('status', () => {
    it('default é active', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.status).toBe('active')
    })
    it('aceita 5 valores', () => {
      for (const s of ['active','on_hold','someday','done','archived'] as const) {
        expect(ProjectSaveSchema.safeParse({ ...baseValid, status: s }).success).toBe(true)
      }
    })
    it('rejeita inválido', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, status: 'pending' }).success).toBe(false)
    })
  })

  describe('horizon', () => {
    it('default é H1', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.horizon).toBe('H1')
    })
    it('aceita H0..H5', () => {
      for (const h of ['H0','H1','H2','H3','H4','H5'] as const) {
        expect(ProjectSaveSchema.safeParse({ ...baseValid, horizon: h }).success).toBe(true)
      }
    })
    it('rejeita H6', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, horizon: 'H6' }).success).toBe(false)
    })
  })

  describe('AQAL fields', () => {
    const uuid = '00000000-0000-0000-0000-000000000001'
    it('aceita areaId UUID', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, areaId: uuid }).success).toBe(true)
    })
    it('rejeita areaId não-UUID', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, areaId: 'abc' }).success).toBe(false)
    })
    it('aceita quadrantOverride válido', () => {
      for (const q of ['I','IT','WE','ITS'] as const) {
        expect(ProjectSaveSchema.safeParse({ ...baseValid, quadrantOverride: q }).success).toBe(true)
      }
    })
    it('aceita parentId UUID', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, parentId: uuid }).success).toBe(true)
    })
  })

  describe('targetDate', () => {
    it('aceita YYYY-MM-DD', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, targetDate: '2026-05-20' }).success).toBe(true)
    })
    it('rejeita ISO datetime', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, targetDate: '2026-05-20T15:00:00Z' }).success).toBe(false)
    })
  })
})

describe('ProjectArchiveSchema', () => {
  it('exige id UUID', () => {
    expect(ProjectArchiveSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    expect(ProjectArchiveSchema.safeParse({}).success).toBe(false)
    expect(ProjectArchiveSchema.safeParse({ id: 'abc' }).success).toBe(false)
  })
})

describe('ProjectCompleteSchema', () => {
  it('exige id UUID', () => {
    expect(ProjectCompleteSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    expect(ProjectCompleteSchema.safeParse({}).success).toBe(false)
  })
})
