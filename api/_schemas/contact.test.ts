import { describe, it, expect } from 'vitest'
import { ContactSaveSchema, InteractionSaveSchema } from './contact.js'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('ContactSaveSchema (regressão — payload pré-Carnegie)', () => {
  it('aceita payload mínimo legado', () => {
    const r = ContactSaveSchema.safeParse({ firstName: 'Jorge' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.tags).toEqual([])
      expect(r.data.notes).toBe('')
    }
  })

  it('aceita payload completo legado', () => {
    expect(ContactSaveSchema.safeParse({
      firstName: 'Marina', lastName: 'Silva',
      email: 'marina@x.com', phone: '+5511999',
      birthday: '12/03', tags: ['cliente'],
      phase: 'active', nextContact: 'café',
      notes: 'qualquer coisa',
    }).success).toBe(true)
  })

  it('rejeita firstName vazio', () => {
    expect(ContactSaveSchema.safeParse({ firstName: '' }).success).toBe(false)
  })

  it('rejeita birthday fora do regex DD/MM', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'A', birthday: '2026-05-12' }).success).toBe(false)
    expect(ContactSaveSchema.safeParse({ firstName: 'A', birthday: '5/12' }).success).toBe(false)
  })
})

describe('ContactSaveSchema (Carnegie — campos novos)', () => {
  it('aceita tier válido', () => {
    for (const tier of ['inner', 'strong', 'network', 'weak', 'dormant']) {
      const r = ContactSaveSchema.safeParse({ firstName: 'X', tier })
      expect(r.success).toBe(true)
    }
  })

  it('rejeita tier inválido', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', tier: 'vip' }).success).toBe(false)
  })

  it('aceita preferredChannel válido', () => {
    for (const ch of ['whatsapp', 'email', 'linkedin', 'sms', 'phone']) {
      expect(ContactSaveSchema.safeParse({ firstName: 'X', preferredChannel: ch }).success).toBe(true)
    }
  })

  it('rejeita preferredChannel inválido', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', preferredChannel: 'telegram' }).success).toBe(false)
  })

  it('aceita cadenceDays positivo', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', cadenceDays: 14 }).success).toBe(true)
  })

  it('rejeita cadenceDays zero ou negativo', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', cadenceDays: 0 }).success).toBe(false)
    expect(ContactSaveSchema.safeParse({ firstName: 'X', cadenceDays: -1 }).success).toBe(false)
  })

  it('aceita family parcial', () => {
    expect(ContactSaveSchema.safeParse({
      firstName: 'X',
      family: { spouse: 'Ana', children: ['Bia', 'Caio'] },
    }).success).toBe(true)
    expect(ContactSaveSchema.safeParse({
      firstName: 'X',
      family: {},
    }).success).toBe(true)
  })

  it('aceita lastSignal parcial', () => {
    expect(ContactSaveSchema.safeParse({
      firstName: 'X',
      lastSignal: { type: 'linkedin_post', text: 'lançou produto', url: 'https://linkedin.com/post/1' },
    }).success).toBe(true)
  })

  it('aceita companyStartDate YYYY-MM-DD', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', companyStartDate: '2020-01-15' }).success).toBe(true)
  })

  it('rejeita companyStartDate em formato errado', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', companyStartDate: '15/01/2020' }).success).toBe(false)
  })

  it('aceita firstMetAt ISO datetime', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', firstMetAt: '2026-05-12T10:00:00.000Z' }).success).toBe(true)
  })

  it('aceita sourceContactId UUID', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', sourceContactId: UUID }).success).toBe(true)
  })

  it('rejeita sourceContactId não-UUID', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', sourceContactId: 'abc' }).success).toBe(false)
  })

  it('aceita linkedinUrl válida e rejeita não-URL', () => {
    expect(ContactSaveSchema.safeParse({ firstName: 'X', linkedinUrl: 'https://linkedin.com/in/jorge' }).success).toBe(true)
    expect(ContactSaveSchema.safeParse({ firstName: 'X', linkedinUrl: 'notaurl' }).success).toBe(false)
  })
})

describe('InteractionSaveSchema (regressão)', () => {
  it('aceita payload mínimo legado', () => {
    const r = InteractionSaveSchema.safeParse({
      contactId: UUID,
      date: '2026-05-12T10:00:00.000Z',
      type: 'meeting',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.note).toBe('')
  })

  it('rejeita type inválido', () => {
    expect(InteractionSaveSchema.safeParse({
      contactId: UUID, date: '2026-05-12T10:00:00.000Z', type: 'dm',
    }).success).toBe(false)
  })

  it('rejeita date não-ISO', () => {
    expect(InteractionSaveSchema.safeParse({
      contactId: UUID, date: '2026-05-12', type: 'call',
    }).success).toBe(false)
  })
})

describe('InteractionSaveSchema (Carnegie — campos novos)', () => {
  const base = { contactId: UUID, date: '2026-05-12T10:00:00.000Z', type: 'meeting' as const }

  it('aceita initiator válido', () => {
    expect(InteractionSaveSchema.safeParse({ ...base, initiator: 'me' }).success).toBe(true)
    expect(InteractionSaveSchema.safeParse({ ...base, initiator: 'them' }).success).toBe(true)
  })

  it('rejeita initiator inválido', () => {
    expect(InteractionSaveSchema.safeParse({ ...base, initiator: 'both' }).success).toBe(false)
  })

  it('aceita sentiment válido', () => {
    for (const s of ['positive', 'neutral', 'tense']) {
      expect(InteractionSaveSchema.safeParse({ ...base, sentiment: s }).success).toBe(true)
    }
  })

  it('rejeita sentiment inválido', () => {
    expect(InteractionSaveSchema.safeParse({ ...base, sentiment: 'happy' }).success).toBe(false)
  })

  it('aceita carnegieTags P1..P30', () => {
    expect(InteractionSaveSchema.safeParse({ ...base, carnegieTags: ['P1', 'P15', 'P30'] }).success).toBe(true)
  })

  it('rejeita carnegieTags fora do range', () => {
    expect(InteractionSaveSchema.safeParse({ ...base, carnegieTags: ['P0'] }).success).toBe(false)
    expect(InteractionSaveSchema.safeParse({ ...base, carnegieTags: ['P31'] }).success).toBe(false)
    expect(InteractionSaveSchema.safeParse({ ...base, carnegieTags: ['p1'] }).success).toBe(false)
    expect(InteractionSaveSchema.safeParse({ ...base, carnegieTags: ['gave_intro'] }).success).toBe(false)
  })

  it('aceita interactionTags arbitrários (text[] aberto)', () => {
    expect(InteractionSaveSchema.safeParse({
      ...base, interactionTags: ['gave_intro', 'received_gift', 'gratitude'],
    }).success).toBe(true)
  })

  it('aceita referralFromId UUID', () => {
    expect(InteractionSaveSchema.safeParse({ ...base, referralFromId: UUID }).success).toBe(true)
  })

  it('aceita conjunto completo', () => {
    expect(InteractionSaveSchema.safeParse({
      ...base,
      initiator: 'them',
      sentiment: 'positive',
      topicsDiscussed: ['IA', 'STATE'],
      carnegieTags: ['P7', 'P9'],
      interactionTags: ['gave_advice'],
      complimentText: 'achou o briefing genial',
      referralFromId: UUID,
      newLearning: 'tem filho recém-nascido',
      promiseMade: 'mandar deck até sexta',
    }).success).toBe(true)
  })
})
