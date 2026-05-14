import type { TaskSaveInput } from '../../api/_schemas/task.ts'

type Priority = NonNullable<TaskSaveInput['priority']>
type Status = NonNullable<TaskSaveInput['status']>

export interface ParsedQuery {
  text: string                     // remaining text to match in title/notes
  projectName?: string
  areaName?: string
  tags?: string[]
  dueDateFrom?: string             // YYYY-MM-DD inclusive
  dueDateTo?: string               // YYYY-MM-DD inclusive
  priority?: Priority
  status?: Status
}

const pad = (n: number): string => String(n).padStart(2, '0')
const fmt = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

function strip(text: string, re: RegExp): string {
  return text.replace(re, ' ').replace(/\s+/g, ' ').trim()
}

function parseDayMonth(dayStr: string, monthStr: string, fallbackYear: number): Date | null {
  const day = parseInt(dayStr, 10)
  let month: number
  if (/^\d+$/.test(monthStr)) {
    month = parseInt(monthStr, 10)
  } else {
    const lower = monthStr.toLowerCase()
    month = MONTHS[lower] ?? 0
  }
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  return new Date(fallbackYear, month - 1, day)
}

export function parseQuery(raw: string, now: Date = new Date()): ParsedQuery {
  let text = raw.trim()
  const result: ParsedQuery = { text: '' }
  const year = now.getFullYear()

  // "vencimento entre DD/MM e DD/MM" | "DD de MES e DD de MES"
  // Aceita "20 e 27/05" (mês do segundo serve pro primeiro), "20/05 e 27/05",
  // "20 de maio e 27 de maio".
  const rangeRe = /\bvencimento\s+entre\s+(\d{1,2})(?:[\/-](\d{1,2}))?(?:\s+de\s+([a-zçãéí]+))?\s+e\s+(\d{1,2})(?:[\/-](\d{1,2}))?(?:\s+de\s+([a-zçãéí]+))?/i
  const mr = text.match(rangeRe)
  if (mr) {
    const month1 = mr[2] ?? mr[3]
    const month2 = mr[5] ?? mr[6]
    const m1 = month1 ?? month2 ?? ''
    const m2 = month2 ?? month1 ?? ''
    const d1 = m1 ? parseDayMonth(mr[1] ?? '0', m1, year) : null
    const d2 = m2 ? parseDayMonth(mr[4] ?? '0', m2, year) : null
    if (d1) result.dueDateFrom = fmt(d1)
    if (d2) result.dueDateTo = fmt(d2)
    text = strip(text, rangeRe)
  }

  // "vence/vencimento hoje|amanhã|DD/MM|DD de MES"
  if (!result.dueDateFrom) {
    let m = text.match(/\b(vence|vencimento|vencendo)\s+hoje\b/i)
    if (m) {
      result.dueDateFrom = fmt(now)
      result.dueDateTo = fmt(now)
      text = strip(text, /\b(vence|vencimento|vencendo)\s+hoje\b/gi)
    } else {
      m = text.match(/\b(vence|vencimento|vencendo)\s+amanh[ãa](?=\s|$|[,;.])/i)
      if (m) {
        const t = new Date(now); t.setDate(now.getDate() + 1)
        result.dueDateFrom = fmt(t)
        result.dueDateTo = fmt(t)
        text = strip(text, /\b(vence|vencimento|vencendo)\s+amanh[ãa](?=\s|$|[,;.])/gi)
      } else {
        m = text.match(/\b(vence|vencimento|vencendo)\s+(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/i)
        if (m) {
          let y = m[4] ? parseInt(m[4], 10) : year
          if (y < 100) y += 2000
          const d = parseDayMonth(m[2] ?? '0', m[3] ?? '0', y)
          if (d) {
            result.dueDateFrom = fmt(d)
            result.dueDateTo = fmt(d)
            text = strip(text, /\b(vence|vencimento|vencendo)\s+\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/gi)
          }
        }
      }
    }
  }

  // project
  let pm = text.match(/\bprojeto\s+"([^"]+)"/i)
  if (pm && pm[1]) {
    result.projectName = pm[1].trim()
    text = strip(text, /\bprojeto\s+"[^"]+"/gi)
  } else {
    pm = text.match(/\bprojeto\s+([\wáàâãéêíóôõúç-]+)/i)
    if (pm && pm[1]) {
      result.projectName = pm[1].trim()
      text = strip(text, /\bprojeto\s+[\wáàâãéêíóôõúç-]+/gi)
    }
  }

  // area
  let am = text.match(/\b[áa]rea\s+"([^"]+)"/i)
  if (am && am[1]) {
    result.areaName = am[1].trim()
    text = strip(text, /\b[áa]rea\s+"[^"]+"/gi)
  } else {
    am = text.match(/\b[áa]rea\s+([\wáàâãéêíóôõúç-]+)/i)
    if (am && am[1]) {
      result.areaName = am[1].trim()
      text = strip(text, /\b[áa]rea\s+[\wáàâãéêíóôõúç-]+/gi)
    }
  }

  // tags
  const tagMatches = text.match(/#[\w-]+/g)
  if (tagMatches) {
    result.tags = tagMatches.map(t => t.slice(1))
    text = strip(text, /#[\w-]+/g)
  }

  // priority
  if (/!alta|!p1\b|\burgentes?\b/i.test(text)) {
    result.priority = 'high'
    text = strip(text, /!alta|!p1\b|\burgentes?\b/gi)
  } else if (/!baixa|!p3\b/i.test(text)) {
    result.priority = 'low'
    text = strip(text, /!baixa|!p3\b/gi)
  }

  // status
  if (/\b(conclu[íi]d[ao]s?|feitas?|done|fechadas?)\b/i.test(text)) {
    result.status = 'done'
    text = strip(text, /\b(conclu[íi]d[ao]s?|feitas?|done|fechadas?)\b/gi)
  } else if (/\b(abertas?|pendentes?|open)\b/i.test(text)) {
    // status placeholder — convention: undefined status means 'open' filter
    text = strip(text, /\b(abertas?|pendentes?|open)\b/gi)
  } else if (/\b(fazendo|doing|in progress|wip)\b/i.test(text)) {
    result.status = 'doing'
    text = strip(text, /\b(fazendo|doing|in progress|wip)\b/gi)
  } else if (/\baguardando\b/i.test(text)) {
    result.status = 'waiting'
    text = strip(text, /\baguardando\b/gi)
  }

  // Cleanup connector words
  text = text.replace(/\b(tasks?|tarefas?|com|de|do|da|no|na|em)\b/gi, ' ')
  text = text.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim()

  result.text = text
  return result
}

export function hasFilter(q: ParsedQuery): boolean {
  return !!(q.projectName || q.areaName || q.tags?.length || q.dueDateFrom || q.dueDateTo || q.priority || q.status || q.text)
}

interface Filterable {
  title: string
  notes?: string
  projectId?: string
  areaId?: string
  tags: string[]
  status?: string
  priority?: string
  dueAt?: string
  dueDate?: string
}

interface NameResolver {
  projects: { id: string; name: string }[]
  areas: { id: string; name: string }[]
}

export function resolveQueryIds(q: ParsedQuery, { projects, areas }: NameResolver): {
  projectIds?: string[]
  areaIds?: string[]
} {
  const out: { projectIds?: string[]; areaIds?: string[] } = {}
  if (q.projectName) {
    const needle = q.projectName.toLowerCase()
    const ids = projects.filter(p => p.name.toLowerCase().includes(needle)).map(p => p.id)
    if (ids.length > 0) out.projectIds = ids
  }
  if (q.areaName) {
    const needle = q.areaName.toLowerCase()
    const ids = areas.filter(a => a.name.toLowerCase().includes(needle)).map(a => a.id)
    if (ids.length > 0) out.areaIds = ids
  }
  return out
}

export function applyQuery<T extends Filterable>(
  items: T[],
  q: ParsedQuery,
  resolver: NameResolver,
): T[] {
  const ids = resolveQueryIds(q, resolver)
  const needle = q.text.toLowerCase()
  return items.filter(item => {
    if (ids.projectIds?.length) {
      if (!item.projectId || !ids.projectIds.includes(item.projectId)) return false
    }
    if (ids.areaIds?.length) {
      if (!item.areaId || !ids.areaIds.includes(item.areaId)) return false
    }
    if (q.tags?.length && !q.tags.some(t => item.tags.includes(t))) return false
    if (q.priority && item.priority !== q.priority) return false
    if (q.status && item.status !== q.status) return false
    if (q.dueDateFrom || q.dueDateTo) {
      const dueIso = item.dueAt ?? (item.dueDate ? `${item.dueDate}T00:00:00Z` : undefined)
      if (!dueIso) return false
      const day = dueIso.slice(0, 10)
      if (q.dueDateFrom && day < q.dueDateFrom) return false
      if (q.dueDateTo && day > q.dueDateTo) return false
    }
    if (needle) {
      const hay = `${item.title} ${item.notes ?? ''}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}
