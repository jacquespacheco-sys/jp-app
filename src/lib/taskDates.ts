// Leitura canônica de datas de tarefa.
//
// O prazo (`due`) tem fonte única: `dueAt` — um instante. `dueDate` é legado,
// vem de uma coluna `timestamptz` (a API serializa como ISO completo, ex.
// '2026-05-23T00:00:00+00:00') e é apenas espelho mantido por trigger no banco.
// Aqui sempre preferimos `dueAt` e só caímos em `dueDate` lendo sua porção de
// data, nunca convertendo-o por timezone (isso o deslocaria um dia em fusos
// negativos como America/Sao_Paulo).

export type TaskGroupKey = 'overdue' | 'today' | 'next7' | 'undated'

const pad = (n: number): string => String(n).padStart(2, '0')

export function localDayStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr(): string {
  return localDayStr(new Date())
}

export function addDaysStr(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localDayStr(d)
}

// Dia local (YYYY-MM-DD) de um instante (scheduledAt/completedAt), ou null.
export function localDayOf(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return localDayStr(d)
}

export function isSameLocalDay(iso: string | undefined, day: string): boolean {
  return localDayOf(iso) === day
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Dia do prazo da tarefa como YYYY-MM-DD, ou null.
//
// Há duas naturezas de prazo no banco e elas pedem tratamento OPOSTO:
//  - "dia inteiro" (Google Tasks, espelho due_date): armazenado à meia-noite
//    UTC, sem hora real. Converter pro fuso local jogaria pro dia anterior em
//    UTC-3 → usamos o dia-calendário UTC como está.
//  - instante real (data+hora escolhida no painel): o dia que importa é o
//    LOCAL do usuário (ex.: 22h em SP ainda é "hoje", mesmo virando o dia em UTC).
// Distinguimos pela hora UTC: meia-noite exata = dia inteiro; senão = instante.
// Preferimos dueAt porque é ele que carrega a hora real (due_date é só :date).
export function dueDayKey(t: { dueAt?: string; dueDate?: string }): string | null {
  const raw = t.dueAt ?? t.dueDate
  if (!raw) return null
  if (DATE_ONLY.test(raw)) return raw
  const d = new Date(raw)
  if (isNaN(d.getTime())) {
    const slice = raw.slice(0, 10)
    return DATE_ONLY.test(slice) ? slice : null
  }
  const isAllDayUtc =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  return isAllDayUtc ? d.toISOString().slice(0, 10) : localDayStr(d)
}

export function dueBucket(
  dayKey: string | null,
  status: string,
  today: string,
  in7: string,
): TaskGroupKey | null {
  if (dayKey != null && dayKey < today) return 'overdue'
  if (dayKey === today) return 'today'
  if (status === 'doing' && (dayKey == null || dayKey <= today)) return 'today'
  if (dayKey != null && dayKey > today && dayKey <= in7) return 'next7'
  if (dayKey == null) return 'undated'
  return null
}
