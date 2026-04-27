import type { TaskSaveInput } from '../../api/_schemas/task.ts'

export interface ParsedTask {
  title: string
  priority: NonNullable<TaskSaveInput['priority']>
  dueDate?: string
  tags: string[]
}

export function parseInput(raw: string, now = new Date()): ParsedTask {
  let text = raw.trim()
  let priority: ParsedTask['priority'] = 'med'
  let dueDate: string | undefined
  const tags: string[] = []

  // Priority
  if (/!alta|!p1/i.test(text)) {
    priority = 'high'
    text = text.replace(/!alta|!p1/gi, '').trim()
  } else if (/!baixa|!p3/i.test(text)) {
    priority = 'low'
    text = text.replace(/!baixa|!p3/gi, '').trim()
  } else if (/!media|!p2/i.test(text)) {
    priority = 'med'
    text = text.replace(/!media|!p2/gi, '').trim()
  }

  // Dates
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (/\bhoje\b/i.test(text)) {
    dueDate = fmt(now)
    text = text.replace(/\bhoje\b/gi, '').trim()
  } else if (/\bamanh[ãa](?=\s|$)/i.test(text)) {
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    dueDate = fmt(tomorrow)
    text = text.replace(/\bamanh[ãa](?=\s|$)/gi, '').trim()
  }

  // Tags
  const tagMatches = text.match(/#[\w-]+/g)
  if (tagMatches) {
    tags.push(...tagMatches.map(t => t.slice(1)))
    text = text.replace(/#[\w-]+/g, '').trim()
  }

  const result: ParsedTask = { title: text, priority, tags }
  if (dueDate !== undefined) result.dueDate = dueDate
  return result
}
