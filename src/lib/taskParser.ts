import type { TaskSaveInput } from '../../api/_schemas/task.ts'

type Priority = NonNullable<TaskSaveInput['priority']>
type Status = NonNullable<TaskSaveInput['status']>

export interface ParsedTask {
  title: string
  priority: Priority
  dueDate?: string         // YYYY-MM-DD
  dueAt?: string           // ISO with time
  tags: string[]
  projectName?: string     // hint to resolve via name match
  areaName?: string
  status?: Status
}

const pad = (n: number): string => String(n).padStart(2, '0')
const fmtDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, segunda: 1, 'segunda-feira': 1, terca: 2, 'terça': 2, 'terça-feira': 2,
  quarta: 3, 'quarta-feira': 3, quinta: 4, 'quinta-feira': 4,
  sexta: 5, 'sexta-feira': 5, sabado: 6, 'sábado': 6,
  seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0,
}

function stripWord(text: string, re: RegExp): string {
  return text.replace(re, ' ').replace(/\s+/g, ' ').trim()
}

function extractTime(text: string): { time: { h: number; m: number } | null; rest: string } {
  // Anchors: (?:^|\s) no início (já que "às" começa com não-\w),
  //          (?=\s|$|[,;.]) no final.
  // "às HH:MM" / "HH:MM"
  let m = text.match(/(^|\s)((?:[àa]s?\s+)?(\d{1,2}):(\d{2}))(?=\s|$|[,;.])/i)
  if (m) {
    const h = parseInt(m[3] ?? '0', 10)
    const mm = parseInt(m[4] ?? '0', 10)
    if (h >= 0 && h < 24 && mm >= 0 && mm < 60) {
      return { time: { h, m: mm }, rest: text.replace(m[0], ' ').replace(/\s+/g, ' ').trim() }
    }
  }
  // "às 10am" / "10am"
  m = text.match(/(^|\s)((?:[àa]s?\s+)?(\d{1,2})\s?(am|pm))(?=\s|$|[,;.])/i)
  if (m) {
    let h = parseInt(m[3] ?? '0', 10)
    const ap = (m[4] ?? '').toLowerCase()
    if (h >= 1 && h <= 12) {
      if (ap === 'pm' && h !== 12) h += 12
      if (ap === 'am' && h === 12) h = 0
      return { time: { h, m: 0 }, rest: text.replace(m[0], ' ').replace(/\s+/g, ' ').trim() }
    }
  }
  // "às 18h" / "18h"
  m = text.match(/(^|\s)((?:[àa]s?\s+)?(\d{1,2})h(?:oras?)?)(?=\s|$|[,;.])/i)
  if (m) {
    const h = parseInt(m[3] ?? '0', 10)
    if (h >= 0 && h < 24) {
      return { time: { h, m: 0 }, rest: text.replace(m[0], ' ').replace(/\s+/g, ' ').trim() }
    }
  }
  return { time: null, rest: text }
}

function extractDate(text: string, now: Date): { date: Date | null; rest: string } {
  // hoje
  let m = text.match(/\bhoje\b/i)
  if (m) return { date: new Date(now), rest: stripWord(text, /\bhoje\b/gi) }

  // amanhã (ã não é \w, então usamos lookahead em vez de \b à direita)
  m = text.match(/\bamanh[ãa](?=\s|$|[,;.])/i)
  if (m) {
    const d = new Date(now); d.setDate(now.getDate() + 1)
    return { date: d, rest: stripWord(text, /\bamanh[ãa](?=\s|$|[,;.])/gi) }
  }

  // depois de amanhã
  m = text.match(/\bdepois de amanh[ãa](?=\s|$|[,;.])/i)
  if (m) {
    const d = new Date(now); d.setDate(now.getDate() + 2)
    return { date: d, rest: stripWord(text, /\bdepois de amanh[ãa](?=\s|$|[,;.])/gi) }
  }

  // próxima semana / semana que vem
  m = text.match(/\b(pr[óo]xima semana|semana que vem)\b/i)
  if (m) {
    const d = new Date(now); d.setDate(now.getDate() + 7)
    return { date: d, rest: stripWord(text, /\b(pr[óo]xima semana|semana que vem)\b/gi) }
  }

  // weekday names
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    const reSrc = `\\b${name}(?:[- ]feira)?\\b`
    const re = new RegExp(reSrc, 'i')
    if (re.test(text)) {
      const d = new Date(now)
      const cur = now.getDay()
      let diff = dow - cur
      if (diff <= 0) diff += 7
      d.setDate(now.getDate() + diff)
      return { date: d, rest: stripWord(text, new RegExp(reSrc, 'gi')) }
    }
  }

  // "DD de MES" e "DD de MES de YYYY"
  m = text.match(/\b(\d{1,2})\s+de\s+([a-zçãéí]+)(?:\s+de\s+(\d{4}))?\b/i)
  if (m) {
    const day = parseInt(m[1] ?? '0', 10)
    const monName = (m[2] ?? '').toLowerCase()
    const month = MONTHS[monName]
    if (month && day >= 1 && day <= 31) {
      const yearStr = m[3]
      const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear()
      const d = new Date(year, month - 1, day)
      if (!yearStr && d < now) d.setFullYear(d.getFullYear() + 1)
      return { date: d, rest: stripWord(text, /\b(\d{1,2})\s+de\s+[a-zçãéí]+(?:\s+de\s+\d{4})?\b/gi) }
    }
  }

  // DD/MM ou DD/MM/YYYY ou DD-MM
  m = text.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/)
  if (m) {
    const day = parseInt(m[1] ?? '0', 10)
    const month = parseInt(m[2] ?? '0', 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const yearStr = m[3]
      let year = yearStr ? parseInt(yearStr, 10) : now.getFullYear()
      if (yearStr && year < 100) year += 2000
      const d = new Date(year, month - 1, day)
      if (!yearStr && d < now) d.setFullYear(d.getFullYear() + 1)
      return { date: d, rest: stripWord(text, /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g) }
    }
  }

  return { date: null, rest: text }
}

function extractPriority(text: string): { priority: Priority | null; rest: string } {
  if (/!alta|!p1\b|\burgente\b/i.test(text)) {
    return { priority: 'high', rest: stripWord(text, /!alta|!p1\b|\burgente\b/gi) }
  }
  if (/!baixa|!p3\b/i.test(text)) {
    return { priority: 'low', rest: stripWord(text, /!baixa|!p3\b/gi) }
  }
  if (/!media|!p2\b/i.test(text)) {
    return { priority: 'med', rest: stripWord(text, /!media|!p2\b/gi) }
  }
  return { priority: null, rest: text }
}

function extractStatus(text: string): { status: Status | null; rest: string } {
  if (/\b(fazendo|in progress|wip)\b/i.test(text)) {
    return { status: 'doing', rest: stripWord(text, /\b(fazendo|in progress|wip)\b/gi) }
  }
  if (/\b(feito|conclu[íi]d[ao]|done)\b/i.test(text)) {
    return { status: 'done', rest: stripWord(text, /\b(feito|conclu[íi]d[ao]|done)\b/gi) }
  }
  if (/\baguardando\b/i.test(text)) {
    return { status: 'waiting', rest: stripWord(text, /\baguardando\b/gi) }
  }
  if (/\b(bloqueado|bloqueada|blocked)\b/i.test(text)) {
    return { status: 'blocked', rest: stripWord(text, /\b(bloqueado|bloqueada|blocked)\b/gi) }
  }
  if (/\b(algum dia|someday)\b/i.test(text)) {
    return { status: 'someday', rest: stripWord(text, /\b(algum dia|someday)\b/gi) }
  }
  return { status: null, rest: text }
}

function extractProject(text: string): { name: string | null; rest: string } {
  // "projeto X" — captura uma palavra; aspas suportam multi-palavra
  let m = text.match(/\bprojeto\s+"([^"]+)"/i)
  if (m && m[1]) return { name: m[1].trim(), rest: stripWord(text, /\bprojeto\s+"[^"]+"/gi) }
  m = text.match(/\bprojeto\s+([\wáàâãéêíóôõúç-]+)/i)
  if (m && m[1]) return { name: m[1].trim(), rest: stripWord(text, /\bprojeto\s+[\wáàâãéêíóôõúç-]+/gi) }
  return { name: null, rest: text }
}

function extractArea(text: string): { name: string | null; rest: string } {
  let m = text.match(/\b[áa]rea\s+"([^"]+)"/i)
  if (m && m[1]) return { name: m[1].trim(), rest: stripWord(text, /\b[áa]rea\s+"[^"]+"/gi) }
  m = text.match(/\b[áa]rea\s+([\wáàâãéêíóôõúç-]+)/i)
  if (m && m[1]) return { name: m[1].trim(), rest: stripWord(text, /\b[áa]rea\s+[\wáàâãéêíóôõúç-]+/gi) }
  return { name: null, rest: text }
}

function extractTags(text: string): { tags: string[]; rest: string } {
  const matches = text.match(/#[\w-]+/g)
  if (!matches) return { tags: [], rest: text }
  return {
    tags: matches.map(t => t.slice(1)),
    rest: stripWord(text, /#[\w-]+/g),
  }
}

export function parseInput(raw: string, now: Date = new Date()): ParsedTask {
  let text = raw.trim()

  const pr = extractPriority(text); text = pr.rest
  const tg = extractTags(text); text = tg.rest
  const st = extractStatus(text); text = st.rest
  const pj = extractProject(text); text = pj.rest
  const ar = extractArea(text); text = ar.rest
  const tm = extractTime(text); text = tm.rest
  const dt = extractDate(text, now); text = dt.rest

  let dueDate: string | undefined
  let dueAt: string | undefined
  if (dt.date) {
    if (tm.time) {
      const d = new Date(dt.date)
      d.setHours(tm.time.h, tm.time.m, 0, 0)
      dueAt = d.toISOString()
      dueDate = fmtDate(d)
    } else {
      dueDate = fmtDate(dt.date)
    }
  } else if (tm.time) {
    const d = new Date(now)
    d.setHours(tm.time.h, tm.time.m, 0, 0)
    if (d < now) d.setDate(d.getDate() + 1)
    dueAt = d.toISOString()
    dueDate = fmtDate(d)
  }

  // Cleanup connector words left over ("para", "em", "às", "no", "na", commas)
  text = text.replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim()
  text = text.replace(/\b(em|no|na|às|as|para|pra)\s*$/i, '').trim()

  const result: ParsedTask = {
    title: text,
    priority: pr.priority ?? 'med',
    tags: tg.tags,
  }
  if (dueDate !== undefined) result.dueDate = dueDate
  if (dueAt !== undefined) result.dueAt = dueAt
  if (pj.name) result.projectName = pj.name
  if (ar.name) result.areaName = ar.name
  if (st.status) result.status = st.status
  return result
}

export function hasStructure(p: ParsedTask): boolean {
  return (
    p.dueDate !== undefined ||
    p.dueAt !== undefined ||
    p.projectName !== undefined ||
    p.areaName !== undefined ||
    p.status !== undefined ||
    p.priority !== 'med' ||
    p.tags.length > 0
  )
}
