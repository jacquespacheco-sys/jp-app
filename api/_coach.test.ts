import { describe, it, expect } from 'vitest'
import { formatSnapshotForPrompt, buildSystemPrompt, type CoachSnapshot } from './_coach.js'

const baseSnapshot: CoachSnapshot = {
  profile: {
    name: 'Coach',
    tone: 'firme-mas-gentil',
    valuesMd: ['fazer pouco mas bem feito'],
    boundaries: 'sem fofoca',
    northStarMd: 'liberdade financeira em 5 anos',
    h3Goals: [{ title: 'lançar v1 STATE', horizon: 'H3' as const, targetDate: '2026-12-31' }],
  },
  memories: [
    { id: 'm1', kind: 'promise', content: 'Jorge prometeu fechar X', relevance: 80 },
  ],
  aqal: {
    quadrants7d: [
      { quadrant: 'I', completed: 3, minutes: 90 },
      { quadrant: 'IT', completed: 0, minutes: 0 },
      { quadrant: 'WE', completed: 1, minutes: 30 },
      { quadrant: 'ITS', completed: 2, minutes: 60 },
    ],
    areasOpen: [{ areaId: 'a1', name: 'STATE', quadrant: 'ITS', open: 5 }],
    topProjects: [],
    totals: { openTasks: 12, completedThisWeek: 6 },
  },
  tasksTop: [
    { title: 'fechar pitch', status: 'next', quadrant: 'ITS', dueAt: '2026-05-15T10:00:00Z' },
  ],
  todayEvents: [{ summary: 'call investidor', startAt: '2026-05-12T14:00:00Z', allDay: false }],
  todayHabits: [{ title: 'leitura', dose: 'full' }, { title: 'caminhada', dose: null }],
  tz: 'America/Sao_Paulo',
}

describe('formatSnapshotForPrompt', () => {
  it('inclui valores e norte', () => {
    const out = formatSnapshotForPrompt(baseSnapshot, 'Jorge')
    expect(out).toContain('fazer pouco mas bem feito')
    expect(out).toContain('liberdade financeira')
    expect(out).toContain('lançar v1 STATE')
  })

  it('inclui memórias ativas com kind e relevance', () => {
    const out = formatSnapshotForPrompt(baseSnapshot, 'Jorge')
    expect(out).toContain('[promise] Jorge prometeu fechar X — relevance 80')
  })

  it('mostra AQAL 7d só com quadrantes com completed > 0', () => {
    const out = formatSnapshotForPrompt(baseSnapshot, 'Jorge')
    expect(out).toContain('I=3')
    expect(out).toContain('WE=1')
    expect(out).toContain('ITS=2')
    expect(out).not.toContain('IT=0')
  })

  it('mostra hábitos pendentes vs feitos', () => {
    const out = formatSnapshotForPrompt(baseSnapshot, 'Jorge')
    expect(out).toContain('leitura: full')
    expect(out).toContain('caminhada: pendente')
  })

  it('renderiza horário do evento no fuso do usuário, não em UTC', () => {
    const out = formatSnapshotForPrompt(baseSnapshot, 'Jorge')
    expect(out).toContain('11:00 call investidor') // 14:00Z → 11:00 em America/Sao_Paulo
    expect(out).not.toContain('14:00')
  })

  it('lida com snapshot sem memórias', () => {
    const empty = { ...baseSnapshot, memories: [] }
    const out = formatSnapshotForPrompt(empty, 'Jorge')
    expect(out).toContain('(nenhuma memória)')
  })
})

describe('buildSystemPrompt', () => {
  it('inclui voz sócio sênior por padrão', () => {
    const out = buildSystemPrompt(baseSnapshot, 'Jorge')
    expect(out).toContain('sócio sênior')
    expect(out).toContain('Letra minúscula')
    expect(out).toContain('NÃO cria tasks')
  })

  it('usa override se presente', () => {
    const overridden = {
      ...baseSnapshot,
      profile: { ...baseSnapshot.profile, systemPromptOverride: 'CUSTOM PROMPT' },
    }
    const out = buildSystemPrompt(overridden, 'Jorge')
    expect(out.startsWith('CUSTOM PROMPT')).toBe(true)
    expect(out).toContain('AQAL 7d') // snapshot ainda anexado
  })
})
