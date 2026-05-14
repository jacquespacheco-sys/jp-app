import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseInput, hasStructure } from './taskParser.ts'

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

  describe('time', () => {
    it('parses HH:MM', () => {
      const r = parseInput('Call hoje 14:30')
      expect(r.dueAt).toMatch(/T17:30:/) // 14:30 BRT → 17:30 UTC; depende de tz local
      expect(r.title).toBe('Call')
    })

    it('parses "às 10am"', () => {
      const r = parseInput('Call amanhã às 10am')
      expect(r.title).toBe('Call')
      expect(r.dueAt).toBeDefined()
    })

    it('parses "18h"', () => {
      const r = parseInput('Stand-up hoje 18h')
      expect(r.title).toBe('Stand-up')
      expect(r.dueAt).toBeDefined()
    })
  })

  describe('project', () => {
    it('extracts "projeto X"', () => {
      const r = parseInput('Ligar João projeto STATE')
      expect(r.projectName).toBe('STATE')
      expect(r.title).toBe('Ligar João')
    })

    it('extracts quoted project', () => {
      const r = parseInput('Bug projeto "JP App"')
      expect(r.projectName).toBe('JP App')
      expect(r.title).toBe('Bug')
    })
  })

  describe('area', () => {
    it('extracts "area X"', () => {
      const r = parseInput('Treino area saude')
      expect(r.areaName).toBe('saude')
      expect(r.title).toBe('Treino')
    })
  })

  describe('priority extra', () => {
    it('recognizes "urgente"', () => {
      const r = parseInput('Bug urgente no checkout')
      expect(r.priority).toBe('high')
    })

    it('does not eat #importante (was buggy)', () => {
      const r = parseInput('Task #importante')
      expect(r.tags).toEqual(['importante'])
      expect(r.priority).toBe('med')
    })
  })

  describe('status', () => {
    it('detects "fazendo"', () => {
      const r = parseInput('Migração db fazendo')
      expect(r.status).toBe('doing')
      expect(r.title).toBe('Migração db')
    })

    it('detects "concluído"', () => {
      const r = parseInput('PR review concluído')
      expect(r.status).toBe('done')
    })
  })

  describe('combined NLP', () => {
    it('parses user-style sentence', () => {
      const r = parseInput('Ligar para João, amanhã às 10am, projeto STATE, urgente')
      expect(r.title).toBe('Ligar para João')
      expect(r.priority).toBe('high')
      expect(r.projectName).toBe('STATE')
      expect(r.dueDate).toBe('2026-04-28')
      expect(r.dueAt).toBeDefined()
    })
  })

  describe('hasStructure', () => {
    it('returns false for plain text', () => {
      expect(hasStructure(parseInput('apenas texto'))).toBe(false)
    })

    it('returns true when due date present', () => {
      expect(hasStructure(parseInput('algo hoje'))).toBe(true)
    })

    it('returns true when project hint present', () => {
      expect(hasStructure(parseInput('algo projeto X'))).toBe(true)
    })

    it('returns true when priority is high/low (not med)', () => {
      expect(hasStructure(parseInput('algo !alta'))).toBe(true)
    })
  })
})
