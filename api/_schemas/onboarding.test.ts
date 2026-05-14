import { describe, it, expect } from 'vitest'
import { OnboardingBulkClassifySchema } from './onboarding.js'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('OnboardingBulkClassifySchema', () => {
  it('aceita 1 update mínimo (só tier)', () => {
    const r = OnboardingBulkClassifySchema.safeParse({
      updates: [{ id: UUID, tier: 'inner' }],
    })
    expect(r.success).toBe(true)
  })

  it('rejeita lista vazia', () => {
    expect(OnboardingBulkClassifySchema.safeParse({ updates: [] }).success).toBe(false)
  })

  it('rejeita > 100 updates', () => {
    const updates = Array.from({ length: 101 }, () => ({ id: UUID, tier: 'weak' as const }))
    expect(OnboardingBulkClassifySchema.safeParse({ updates }).success).toBe(false)
  })

  it('aceita update completo', () => {
    expect(OnboardingBulkClassifySchema.safeParse({
      updates: [{
        id: UUID,
        tier: 'strong',
        addHook: 'novo hook',
        preferredChannel: 'whatsapp',
        linkedinUrl: 'https://linkedin.com/in/jorge',
        cadenceDays: 21,
        categoryIds: [UUID],
      }],
    }).success).toBe(true)
  })

  it('rejeita tier inválido', () => {
    expect(OnboardingBulkClassifySchema.safeParse({
      updates: [{ id: UUID, tier: 'vip' }],
    }).success).toBe(false)
  })

  it('rejeita categoryIds > 50', () => {
    const categoryIds = Array.from({ length: 51 }, (_, i) =>
      `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
    )
    expect(OnboardingBulkClassifySchema.safeParse({
      updates: [{ id: UUID, categoryIds }],
    }).success).toBe(false)
  })

  it('rejeita addHook vazio', () => {
    expect(OnboardingBulkClassifySchema.safeParse({
      updates: [{ id: UUID, addHook: '' }],
    }).success).toBe(false)
  })
})
