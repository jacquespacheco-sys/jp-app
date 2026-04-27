import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseInput } from './taskParser.ts'

const FIXED_DATE = new Date('2026-04-27T12:00:00Z')

describe('parseInput', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('title', () => {
    it('returns plain title unchanged', () => {
      expect(parseInput('Fazer relatório').title).toBe('Fazer relatório')
    })

    it('strips priority tokens from title', () => {
      expect(parseInput('Reunião !alta').title).toBe('Reunião')
      expect(parseInput('Tarefa !p3').title).toBe('Tarefa')
    })

    it('strips date tokens from title', () => {
      expect(parseInput('Call hoje').title).toBe('Call')
      expect(parseInput('Deploy amanhã').title).toBe('Deploy')
    })

    it('strips tags from title', () => {
      expect(parseInput('Task #trabalho').title).toBe('Task')
    })
  })

  describe('priority', () => {
    it('defaults to med', () => {
      expect(parseInput('Task').priority).toBe('med')
    })

    it('parses !alta as high', () => {
      expect(parseInput('Task !alta').priority).toBe('high')
    })

    it('parses !p1 as high', () => {
      expect(parseInput('Task !p1').priority).toBe('high')
    })

    it('parses !baixa as low', () => {
      expect(parseInput('Task !baixa').priority).toBe('low')
    })

    it('parses !p3 as low', () => {
      expect(parseInput('Task !p3').priority).toBe('low')
    })

    it('parses !media as med', () => {
      expect(parseInput('Task !media').priority).toBe('med')
    })

    it('parses !p2 as med', () => {
      expect(parseInput('Task !p2').priority).toBe('med')
    })

    it('is case-insensitive', () => {
      expect(parseInput('Task !ALTA').priority).toBe('high')
    })
  })

  describe('dueDate', () => {
    it('parses "hoje" as today', () => {
      expect(parseInput('Task hoje').dueDate).toBe('2026-04-27')
    })

    it('parses "amanhã" (with accent) as tomorrow', () => {
      expect(parseInput('Task amanhã').dueDate).toBe('2026-04-28')
    })

    it('parses "amanha" (without accent) as tomorrow', () => {
      expect(parseInput('Task amanha').dueDate).toBe('2026-04-28')
    })

    it('returns undefined when no date keyword', () => {
      expect(parseInput('Task sem data').dueDate).toBeUndefined()
    })

    it('is case-insensitive for date keywords', () => {
      expect(parseInput('Task Hoje').dueDate).toBe('2026-04-27')
    })
  })

  describe('tags', () => {
    it('parses single tag', () => {
      expect(parseInput('Task #trabalho').tags).toEqual(['trabalho'])
    })

    it('parses multiple tags', () => {
      expect(parseInput('Task #trabalho #importante').tags).toEqual(['trabalho', 'importante'])
    })

    it('returns empty array when no tags', () => {
      expect(parseInput('Task sem tags').tags).toEqual([])
    })

    it('supports hyphenated tags', () => {
      expect(parseInput('Task #follow-up').tags).toEqual(['follow-up'])
    })
  })

  describe('combined', () => {
    it('parses full input correctly', () => {
      const result = parseInput('Deploy prod !alta amanhã #devops #infra')
      expect(result.title).toBe('Deploy prod')
      expect(result.priority).toBe('high')
      expect(result.dueDate).toBe('2026-04-28')
      expect(result.tags).toEqual(['devops', 'infra'])
    })

    it('parses priority + today', () => {
      const result = parseInput('Reunião cliente hoje !p1')
      expect(result.title).toBe('Reunião cliente')
      expect(result.priority).toBe('high')
      expect(result.dueDate).toBe('2026-04-27')
    })
  })
})
