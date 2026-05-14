import { describe, it, expect } from 'vitest'
import { CategoryDimensionSaveSchema } from './category-dimension.js'
import { CategorySaveSchema, CATEGORY_COLORS } from './category.js'
import { ContactSetCategoriesSchema } from './contact-category.js'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('CategoryDimensionSaveSchema', () => {
  it('aceita payload mínimo', () => {
    const r = CategoryDimensionSaveSchema.safeParse({ label: 'Perfil', slug: 'perfil' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.sortOrder).toBe(0)
  })

  it('rejeita slug com maiúsculas ou caracteres especiais', () => {
    expect(CategoryDimensionSaveSchema.safeParse({ label: 'X', slug: 'Perfil' }).success).toBe(false)
    expect(CategoryDimensionSaveSchema.safeParse({ label: 'X', slug: 'per fil' }).success).toBe(false)
    expect(CategoryDimensionSaveSchema.safeParse({ label: 'X', slug: 'perfil!' }).success).toBe(false)
  })

  it('aceita slug com hífen e underscore', () => {
    expect(CategoryDimensionSaveSchema.safeParse({ label: 'X', slug: 'aproximacao_pessoal-2' }).success).toBe(true)
  })

  it('rejeita label vazio', () => {
    expect(CategoryDimensionSaveSchema.safeParse({ label: '', slug: 'x' }).success).toBe(false)
  })
})

describe('CategorySaveSchema', () => {
  const base = { dimensionId: UUID, label: 'Cliente', slug: 'cliente' }

  it('aceita as 10 cores', () => {
    for (const c of CATEGORY_COLORS) {
      expect(CategorySaveSchema.safeParse({ ...base, color: c }).success).toBe(true)
    }
  })

  it('aceita cor null', () => {
    expect(CategorySaveSchema.safeParse({ ...base, color: null }).success).toBe(true)
  })

  it('rejeita cor fora da paleta', () => {
    expect(CategorySaveSchema.safeParse({ ...base, color: 'magenta' }).success).toBe(false)
  })

  it('rejeita dimensionId não-UUID', () => {
    expect(CategorySaveSchema.safeParse({ ...base, dimensionId: 'abc' }).success).toBe(false)
  })
})

describe('ContactSetCategoriesSchema', () => {
  it('aceita lista vazia (limpa categorias)', () => {
    expect(ContactSetCategoriesSchema.safeParse({ contactId: UUID, categoryIds: [] }).success).toBe(true)
  })

  it('aceita até 100 UUIDs', () => {
    const arr = Array.from({ length: 100 }, (_, i) =>
      `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
    )
    expect(ContactSetCategoriesSchema.safeParse({ contactId: UUID, categoryIds: arr }).success).toBe(true)
  })

  it('rejeita > 100', () => {
    const arr = Array.from({ length: 101 }, (_, i) =>
      `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
    )
    expect(ContactSetCategoriesSchema.safeParse({ contactId: UUID, categoryIds: arr }).success).toBe(false)
  })

  it('rejeita ID não-UUID na lista', () => {
    expect(ContactSetCategoriesSchema.safeParse({ contactId: UUID, categoryIds: ['xyz'] }).success).toBe(false)
  })
})
