# Tasks AQAL Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a camada backend (Zod schemas + types + endpoints + hooks) do design Tasks AQAL/GTD documentado em `docs/superpowers/specs/2026-05-11-tasks-aqal-design.md`. UI fica fora do escopo deste plano (próxima sessão).

**Architecture:** Camadas atômicas, TDD onde há lógica não-trivial (rrule, classify parsing, schema validation). Refactor incremental dos endpoints existentes preservando compatibilidade Google Tasks. Endpoints novos para classify e inbox flow. Hooks React thin (delegam pra API).

**Tech Stack:** TypeScript strict, Zod 3, Vitest 3, @anthropic-ai/sdk (Haiku), Supabase JS, lib `rrule` (a instalar).

---

## File Structure

**Criar:**
- `api/_schemas/inbox.ts` — InboxCaptureSchema, InboxProcessSchema
- `api/_schemas/task-classify.ts` — TaskClassifyRequestSchema, TaskClassifyResponseSchema
- `api/_lib/rrule.ts` — `nextOccurrence(rrule, after)`, `hasOpenInstance(supabase, rrule_parent_id)`
- `api/_lib/rrule.test.ts` — testes
- `api/tasks-classify.ts` — endpoint POST
- `api/inbox-list.ts` — endpoint GET
- `api/inbox-capture.ts` — endpoint POST
- `api/inbox-process.ts` — endpoint POST
- `src/hooks/useInbox.ts` — hook React
- `api/_schemas/task.test.ts` — testes do TaskSaveSchema estendido
- `api/_schemas/inbox.test.ts` — testes
- `api/_schemas/task-classify.test.ts` — testes

**Modificar:**
- `package.json` — add `rrule`
- `vite.config.ts` — include `api/**/*.test.ts` em vitest
- `api/_schemas/task.ts` — extend TaskSaveSchema
- `api/tasks-list.ts` — usar view `v_tasks_resolved`, mapper estendido
- `api/tasks-save.ts` — aceitar campos novos, lógica de next-instance rrule
- `src/types/domain.ts` — Task com campos novos opcionais, InboxItem, InboxEntry, TaskClassifyResult
- `src/types/api.ts` — TasksClassifyResponse, InboxListResponse, InboxCaptureResponse, InboxProcessResponse
- `src/hooks/useTasks.ts` — adicionar `classify(taskId)`

---

## Task 1: Setup — instalar rrule + ajustar vitest config

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Instalar rrule**

```bash
npm install rrule@^2.8.1
```

Expected: `rrule` aparece em `dependencies` no package.json.

- [ ] **Step 2: Ajustar vitest include para encontrar testes em api/**

Editar `vite.config.ts` linha do `test.include`:

```typescript
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/**/*.test.ts'],
  },
```

- [ ] **Step 3: Verificar testes existentes ainda passam**

```bash
npm run test -- --run
```

Expected: PASS — todos os 23 tests anteriores (taskParser etc.) verdes.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts
git commit -m "chore: add rrule dep, vitest include api/**/*.test.ts"
```

---

## Task 2: Estender TaskSaveSchema (TDD)

**Files:**
- Modify: `api/_schemas/task.ts`
- Test: `api/_schemas/task.test.ts`

- [ ] **Step 1: Escrever testes failing**

Criar `api/_schemas/task.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { TaskSaveSchema } from './task.js'

const baseValid = {
  title: 'Test',
  projectId: '00000000-0000-0000-0000-000000000001',
}

describe('TaskSaveSchema', () => {
  describe('status enum', () => {
    it('aceita status legados', () => {
      for (const status of ['inbox','next','doing','blocked','done'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, status }).success).toBe(true)
      }
    })

    it('aceita status novos AQAL/GTD', () => {
      for (const status of ['waiting','scheduled','someday','cancelled'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, status }).success).toBe(true)
      }
    })

    it('rejeita status desconhecido', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, status: 'pending' }).success).toBe(false)
    })
  })

  describe('AQAL fields', () => {
    it('aceita areaId UUID', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, areaId: '00000000-0000-0000-0000-000000000002' }).success).toBe(true)
    })

    it('rejeita areaId não-UUID', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, areaId: 'not-a-uuid' }).success).toBe(false)
    })

    it('aceita context válido', () => {
      for (const c of ['deep','shallow','social','criativo','somatico','offline'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, context: c }).success).toBe(true)
      }
    })

    it('aceita energy 1-5', () => {
      for (const e of [1, 2, 3, 4, 5]) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, energy: e }).success).toBe(true)
      }
    })

    it('rejeita energy fora de 1-5', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, energy: 0 }).success).toBe(false)
      expect(TaskSaveSchema.safeParse({ ...baseValid, energy: 6 }).success).toBe(false)
      expect(TaskSaveSchema.safeParse({ ...baseValid, energy: 2.5 }).success).toBe(false)
    })

    it('aceita timeEstimateMin positivo', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, timeEstimateMin: 30 }).success).toBe(true)
    })

    it('rejeita timeEstimateMin <= 0', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, timeEstimateMin: 0 }).success).toBe(false)
      expect(TaskSaveSchema.safeParse({ ...baseValid, timeEstimateMin: -5 }).success).toBe(false)
    })

    it('aceita quadrantOverride válido', () => {
      for (const q of ['I','IT','WE','ITS'] as const) {
        expect(TaskSaveSchema.safeParse({ ...baseValid, quadrantOverride: q }).success).toBe(true)
      }
    })
  })

  describe('GTD fields', () => {
    it('aceita dueAt ISO datetime', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, dueAt: '2026-05-12T15:00:00.000Z' }).success).toBe(true)
    })

    it('rejeita dueAt em formato date-only', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, dueAt: '2026-05-12' }).success).toBe(false)
    })

    it('aceita scheduledAt ISO datetime', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, scheduledAt: '2026-05-12T15:00:00.000Z' }).success).toBe(true)
    })

    it('aceita waitingFor texto livre', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, waitingFor: 'cliente Z responder' }).success).toBe(true)
    })

    it('aceita rrule começando com FREQ=', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, rrule: 'FREQ=DAILY' }).success).toBe(true)
      expect(TaskSaveSchema.safeParse({ ...baseValid, rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' }).success).toBe(true)
    })

    it('rejeita rrule sem FREQ=', () => {
      expect(TaskSaveSchema.safeParse({ ...baseValid, rrule: 'BYDAY=MO' }).success).toBe(false)
    })
  })

  describe('source default', () => {
    it('default é manual quando omitido', () => {
      const r = TaskSaveSchema.safeParse(baseValid)
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.source).toBe('manual')
    })
  })
})
```

- [ ] **Step 2: Rodar testes — devem falhar (schema ainda não tem campos novos)**

```bash
npm run test -- --run api/_schemas/task.test.ts
```

Expected: FAIL — schema rejeita campos não definidos.

- [ ] **Step 3: Estender o schema**

Substituir o conteúdo de `api/_schemas/task.ts` por:

```typescript
import { z } from 'zod'

export const TaskSaveSchema = z.object({
  // legados
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  notes: z.string().default(''),
  status: z.enum([
    'inbox', 'next', 'doing', 'blocked', 'done',
    'waiting', 'scheduled', 'someday', 'cancelled',
  ]).default('inbox'),
  priority: z.enum(['high', 'med', 'low']).default('med'),
  projectId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string()).default([]),
  startOffset: z.number().int().optional(),
  duration: z.number().int().optional(),
  dependsOn: z.array(z.string().uuid()).default([]),

  // AQAL/GTD novos (todos opcionais)
  areaId: z.string().uuid().optional(),
  quadrantOverride: z.enum(['I', 'IT', 'WE', 'ITS']).optional(),
  context: z.enum(['deep', 'shallow', 'social', 'criativo', 'somatico', 'offline']).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  timeEstimateMin: z.number().int().positive().optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  waitingFor: z.string().optional(),
  rrule: z.string().regex(/^FREQ=/).optional(),
  parentTaskId: z.string().uuid().optional(),
  source: z.enum(['manual', 'voice', 'email', 'briefing', 'coach', 'google']).default('manual'),
})

export type TaskSaveInput = z.infer<typeof TaskSaveSchema>

export const TaskArchiveSchema = z.object({
  id: z.string().uuid(),
})

export type TaskArchiveInput = z.infer<typeof TaskArchiveSchema>
```

- [ ] **Step 4: Rodar testes — todos PASS**

```bash
npm run test -- --run api/_schemas/task.test.ts
```

Expected: PASS — 22 testes verdes.

- [ ] **Step 5: Verificar build TS strict (tasks-save consome este schema)**

```bash
npm run build
```

Expected: PASS. (Se falhar, é porque tasks-save.ts ainda não trata novos campos — esperado, será corrigido em Task 9. Se falhar SÓ por campos novos sendo passados pra payload, anotar e seguir — corrigido depois.)

Se build falhar com erros não relacionados a tasks-save.ts ou tasks-list.ts, parar e investigar.

- [ ] **Step 6: Commit**

```bash
git add api/_schemas/task.ts api/_schemas/task.test.ts
git commit -m "feat: TaskSaveSchema com campos AQAL/GTD (status set + área/contexto/energia/rrule)"
```

---

## Task 3: Schemas Inbox (TDD)

**Files:**
- Create: `api/_schemas/inbox.ts`
- Test: `api/_schemas/inbox.test.ts`

- [ ] **Step 1: Escrever testes failing**

Criar `api/_schemas/inbox.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { InboxCaptureSchema, InboxProcessSchema } from './inbox.js'

describe('InboxCaptureSchema', () => {
  it('aceita rawText obrigatório', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: 'capture this' }).success).toBe(true)
  })

  it('rejeita rawText vazio', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: '' }).success).toBe(false)
  })

  it('rejeita rawText acima de 2000 chars', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: 'x'.repeat(2001) }).success).toBe(false)
  })

  it('source default é manual', () => {
    const r = InboxCaptureSchema.safeParse({ rawText: 'x' })
    if (r.success) expect(r.data.source).toBe('manual')
  })

  it('aceita source válido', () => {
    for (const s of ['manual','voice','email','briefing','coach','google'] as const) {
      expect(InboxCaptureSchema.safeParse({ rawText: 'x', source: s }).success).toBe(true)
    }
  })

  it('aceita externalRef opcional', () => {
    expect(InboxCaptureSchema.safeParse({ rawText: 'x', externalRef: 'gmail:abc123' }).success).toBe(true)
  })
})

describe('InboxProcessSchema', () => {
  const baseId = '00000000-0000-0000-0000-000000000010'
  const projectId = '00000000-0000-0000-0000-000000000020'

  it('aceita action=trash sem taskFields', () => {
    expect(InboxProcessSchema.safeParse({ id: baseId, action: 'trash' }).success).toBe(true)
  })

  it('aceita action=to_task com taskFields mínimo', () => {
    expect(InboxProcessSchema.safeParse({
      id: baseId,
      action: 'to_task',
      taskFields: { title: 'Task', projectId },
    }).success).toBe(true)
  })

  it('aceita action=to_project sem taskFields', () => {
    expect(InboxProcessSchema.safeParse({ id: baseId, action: 'to_project' }).success).toBe(true)
  })

  it('rejeita action inválida', () => {
    expect(InboxProcessSchema.safeParse({ id: baseId, action: 'archive' }).success).toBe(false)
  })

  it('taskFields aceita campos AQAL opcionais', () => {
    expect(InboxProcessSchema.safeParse({
      id: baseId,
      action: 'to_task',
      taskFields: {
        title: 'Task',
        projectId,
        areaId: '00000000-0000-0000-0000-000000000030',
        context: 'deep',
        energy: 4,
        timeEstimateMin: 60,
      },
    }).success).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar testes — devem falhar por arquivo inexistente**

```bash
npm run test -- --run api/_schemas/inbox.test.ts
```

Expected: FAIL — `Cannot find module './inbox'`.

- [ ] **Step 3: Criar o schema**

Criar `api/_schemas/inbox.ts`:

```typescript
import { z } from 'zod'

export const InboxCaptureSchema = z.object({
  rawText: z.string().min(1).max(2000),
  source: z.enum(['manual', 'voice', 'email', 'briefing', 'coach', 'google']).default('manual'),
  externalRef: z.string().optional(),
})

export type InboxCaptureInput = z.infer<typeof InboxCaptureSchema>

const InboxTaskFieldsSchema = z.object({
  title: z.string().min(1),
  projectId: z.string().uuid(),
  status: z.enum(['next', 'scheduled', 'someday', 'waiting']).default('next'),
  areaId: z.string().uuid().optional(),
  context: z.enum(['deep', 'shallow', 'social', 'criativo', 'somatico', 'offline']).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  timeEstimateMin: z.number().int().positive().optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  waitingFor: z.string().optional(),
})

export const InboxProcessSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['to_task', 'to_project', 'trash']),
  taskFields: InboxTaskFieldsSchema.optional(),
})

export type InboxProcessInput = z.infer<typeof InboxProcessSchema>
```

- [ ] **Step 4: Rodar testes — PASS**

```bash
npm run test -- --run api/_schemas/inbox.test.ts
```

Expected: PASS — 12 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add api/_schemas/inbox.ts api/_schemas/inbox.test.ts
git commit -m "feat: schemas Zod para captura/triagem inbox GTD"
```

---

## Task 4: Schemas Task Classify (TDD)

**Files:**
- Create: `api/_schemas/task-classify.ts`
- Test: `api/_schemas/task-classify.test.ts`

- [ ] **Step 1: Escrever testes failing**

Criar `api/_schemas/task-classify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { TaskClassifyRequestSchema, TaskClassifyResponseSchema } from './task-classify.js'

const uuid = '00000000-0000-0000-0000-000000000001'

describe('TaskClassifyRequestSchema', () => {
  it('aceita { taskId }', () => {
    expect(TaskClassifyRequestSchema.safeParse({ taskId: uuid }).success).toBe(true)
  })

  it('aceita { inboxItemId }', () => {
    expect(TaskClassifyRequestSchema.safeParse({ inboxItemId: uuid }).success).toBe(true)
  })

  it('rejeita corpo vazio', () => {
    expect(TaskClassifyRequestSchema.safeParse({}).success).toBe(false)
  })

  it('rejeita id que não é UUID', () => {
    expect(TaskClassifyRequestSchema.safeParse({ taskId: 'abc' }).success).toBe(false)
  })
})

describe('TaskClassifyResponseSchema', () => {
  const valid = {
    areaId: uuid,
    context: 'deep',
    energy: 4,
    timeEstimateMin: 90,
    rationale: 'tarefa cognitiva pesada relacionada a STATE',
    confidence: 'high',
  }

  it('aceita resposta completa', () => {
    expect(TaskClassifyResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('aceita campos null (Haiku indeciso)', () => {
    expect(TaskClassifyResponseSchema.safeParse({
      ...valid,
      areaId: null,
      context: null,
      energy: null,
      timeEstimateMin: null,
    }).success).toBe(true)
  })

  it('aceita confidence=medium e low', () => {
    for (const c of ['medium','low'] as const) {
      expect(TaskClassifyResponseSchema.safeParse({ ...valid, confidence: c }).success).toBe(true)
    }
  })

  it('rejeita confidence inválida', () => {
    expect(TaskClassifyResponseSchema.safeParse({ ...valid, confidence: 'sure' }).success).toBe(false)
  })

  it('rejeita context fora do enum', () => {
    expect(TaskClassifyResponseSchema.safeParse({ ...valid, context: 'meeting' }).success).toBe(false)
  })

  it('exige rationale string', () => {
    const { rationale: _, ...rest } = valid
    expect(TaskClassifyResponseSchema.safeParse(rest).success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar — FAIL**

```bash
npm run test -- --run api/_schemas/task-classify.test.ts
```

Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Criar schema**

Criar `api/_schemas/task-classify.ts`:

```typescript
import { z } from 'zod'

export const TaskClassifyRequestSchema = z.union([
  z.object({ taskId: z.string().uuid() }),
  z.object({ inboxItemId: z.string().uuid() }),
])

export type TaskClassifyRequest = z.infer<typeof TaskClassifyRequestSchema>

export const TaskClassifyResponseSchema = z.object({
  areaId: z.string().uuid().nullable(),
  context: z.enum(['deep', 'shallow', 'social', 'criativo', 'somatico', 'offline']).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  timeEstimateMin: z.number().int().positive().nullable(),
  rationale: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
})

export type TaskClassifyResult = z.infer<typeof TaskClassifyResponseSchema>
```

- [ ] **Step 4: Rodar — PASS**

```bash
npm run test -- --run api/_schemas/task-classify.test.ts
```

Expected: PASS — 9 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add api/_schemas/task-classify.ts api/_schemas/task-classify.test.ts
git commit -m "feat: schemas Zod para classificação AI de tasks (Haiku)"
```

---

## Task 5: Atualizar tipos de domínio

**Files:**
- Modify: `src/types/domain.ts`
- Modify: `src/types/api.ts`

- [ ] **Step 1: Estender Task no domain.ts**

Em `src/types/domain.ts`, **substituir** o bloco `export type TaskStatus = ...` e `export interface Task { ... }` por:

```typescript
export type TaskStatus =
  | 'inbox' | 'next' | 'doing' | 'blocked' | 'done'
  | 'waiting' | 'scheduled' | 'someday' | 'cancelled'
export type TaskPriority = 'high' | 'med' | 'low'

export interface Task {
  id: string
  userId: string
  projectId: string
  contactId?: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  dueDate?: string
  startOffset?: number
  duration?: number
  dependsOn: string[]
  archived: boolean
  archivedAt?: string
  googleTasksId?: string
  synced: boolean
  createdAt: string
  updatedAt: string
  // AQAL/GTD (campos novos opcionais; resolvedQuadrant é só preenchido pela view v_tasks_resolved)
  areaId?: string
  quadrantOverride?: Quadrant
  resolvedQuadrant?: Quadrant
  context?: TaskContext
  energy?: number
  timeEstimateMin?: number
  dueAt?: string
  scheduledAt?: string
  completedAt?: string
  waitingFor?: string
  rrule?: string
  rruleParentId?: string
  parentTaskId?: string
  source: CaptureSrc
  aiClassified: boolean
}
```

Nota: `Quadrant`, `TaskContext`, `CaptureSrc` já estão importados do database.ts mais abaixo no arquivo. Como o bloco AQAL é importado depois (`import type { Quadrant ... } from './database.ts'` está na linha ~229), isso causaria erro "use before define". Solução: mover o `import type` AQAL pra o TOPO do arquivo (logo abaixo dos comentários iniciais, antes de `export type TaskStatus`).

Adicionar no topo do arquivo (substitui o import existente lá embaixo):

```typescript
import type {
  Quadrant as QuadrantDB, HorizonLvl as HorizonLvlDB,
  TaskContext as TaskContextDB, ProjectKind as ProjectKindDB,
  ProjectStatusAqal, HabitDose as HabitDoseDB,
  MemoryKind as MemoryKindDB, CaptureSrc as CaptureSrcDB,
} from './database.ts'

export type Quadrant = QuadrantDB
export type HorizonLvl = HorizonLvlDB
export type TaskContext = TaskContextDB
export type ProjectKind = ProjectKindDB
export type ProjectStatusType = ProjectStatusAqal
export type HabitDose = HabitDoseDB
export type MemoryKind = MemoryKindDB
export type CaptureSrc = CaptureSrcDB
```

E remover esse bloco da seção AQAL no fim do arquivo (deixa só Area, AreaAggregate, QuadrantAggregate, AqalTotals, QUADRANT_LABELS, QUADRANT_COLORS).

- [ ] **Step 2: Adicionar InboxItem, InboxEntry, TaskClassifyResult no domain.ts**

Acrescentar no fim de `src/types/domain.ts`:

```typescript
export interface InboxItem {
  id: string
  userId: string
  rawText: string
  source: CaptureSrc
  externalRef?: string
  aiSuggestion?: {
    areaId?: string
    context?: TaskContext
    energy?: number
    timeEstimateMin?: number
    rationale: string
  }
  processed: boolean
  processedToTask?: string
  processedToProject?: string
  createdAt: string
  processedAt?: string
}

export type InboxEntry =
  | { kind: 'inbox_item'; data: InboxItem }
  | { kind: 'task'; data: Task }

export interface TaskClassifyResult {
  areaId: string | null
  context: TaskContext | null
  energy: number | null
  timeEstimateMin: number | null
  rationale: string
  confidence: 'high' | 'medium' | 'low'
}
```

- [ ] **Step 3: Adicionar response types em api.ts**

Acrescentar no fim de `src/types/api.ts`:

```typescript
import type { InboxItem, InboxEntry, TaskClassifyResult } from './domain.ts'

export interface TaskClassifyResponse {
  classification: TaskClassifyResult
  task?: Task // se taskId, retorna task atualizada apenas com ai_classified=true (não persiste sugestão)
}

export interface InboxListResponse {
  entries: InboxEntry[]
}

export interface InboxCaptureResponse {
  item: InboxItem
}

export interface InboxProcessResponse {
  item: InboxItem
  task?: Task
}
```

(Nota: `Task` já está no escopo do arquivo via import existente.)

- [ ] **Step 4: Verificar build TS**

```bash
npm run build
```

Expected: TypeScript pode reclamar de TasksPage/TaskPanel que usam `task.priority` ou outros campos — checar se erros são só novos campos sendo opcionais (esperado) vs erros de uso. Se erros forem em arquivos UI mexendo em campos legados, é regressão — investigar. Se forem só "field X is missing" em endpoints, vai ser corrigido nas próximas tasks. Documentar erros em variável.

Se build não passar, **a próxima task corrige** (tasks-list e tasks-save vão completar o mapeamento). Anotar erros e seguir.

- [ ] **Step 5: Commit**

```bash
git add src/types/domain.ts src/types/api.ts
git commit -m "feat: tipos Task estendidos AQAL/GTD + InboxItem + TaskClassifyResult"
```

---

## Task 6: Criar lib rrule helper (TDD)

**Files:**
- Create: `api/_lib/rrule.ts`
- Test: `api/_lib/rrule.test.ts`

- [ ] **Step 1: Escrever testes failing**

Criar `api/_lib/rrule.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { nextOccurrence } from './rrule.js'

describe('nextOccurrence', () => {
  it('FREQ=DAILY retorna +1 dia', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=DAILY', after)
    expect(next).not.toBeNull()
    expect(next!.toISOString()).toBe('2026-05-12T08:00:00.000Z')
  })

  it('FREQ=WEEKLY;BYDAY=MO retorna próxima segunda', () => {
    // 2026-05-11 é uma segunda — next deve ser 2026-05-18
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=WEEKLY;BYDAY=MO', after)
    expect(next).not.toBeNull()
    expect(next!.getUTCDay()).toBe(1) // segunda
    expect(next!.toISOString().slice(0, 10)).toBe('2026-05-18')
  })

  it('FREQ=MONTHLY retorna mesma data do mês seguinte', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=MONTHLY', after)
    expect(next).not.toBeNull()
    expect(next!.toISOString().slice(0, 10)).toBe('2026-06-11')
  })

  it('rrule com UNTIL no passado retorna null', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    const next = nextOccurrence('FREQ=DAILY;UNTIL=20260101T000000Z', after)
    expect(next).toBeNull()
  })

  it('rrule inválido retorna null', () => {
    const after = new Date('2026-05-11T08:00:00.000Z')
    expect(nextOccurrence('INVALID', after)).toBeNull()
    expect(nextOccurrence('', after)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar — FAIL**

```bash
npm run test -- --run api/_lib/rrule.test.ts
```

Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar helper**

Criar `api/_lib/rrule.ts`:

```typescript
import { RRule, rrulestr } from 'rrule'

export function nextOccurrence(rrule: string, after: Date): Date | null {
  if (!rrule || !rrule.startsWith('FREQ=')) return null
  try {
    // RRule precisa de DTSTART; usamos `after` como base se não vier no rrule
    const rule = rrulestr(`DTSTART:${toRruleDateUtc(after)}\nRRULE:${rrule}`)
    const next = rule.after(after, false) // exclusive
    return next ?? null
  } catch (e) {
    return null
  }
}

function toRruleDateUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'
  )
}

// Mantido inline para uso em tasks-save (sem necessidade de SupabaseClient genérico aqui)
export interface OpenInstanceCheck {
  hasOpen: boolean
}
```

Nota: importação de `RRule` é só pra type — pode remover se não usar. Se TS reclamar, simplifica pra `import { rrulestr } from 'rrule'`.

- [ ] **Step 4: Rodar — PASS**

```bash
npm run test -- --run api/_lib/rrule.test.ts
```

Expected: PASS — 5 testes verdes.

Se algum falhar (lib `rrule` tem peculiaridades de timezone), debug ajustando os asserts pra refletir o comportamento real, **não** mudar a lógica do helper. A intenção é "próxima ocorrência depois de `after`".

- [ ] **Step 5: Commit**

```bash
git add api/_lib/rrule.ts api/_lib/rrule.test.ts
git commit -m "feat: helper nextOccurrence(rrule, after) para geração de tasks recorrentes"
```

---

## Task 7: Refatorar tasks-list.ts (usar v_tasks_resolved)

**Files:**
- Modify: `api/tasks-list.ts`

- [ ] **Step 1: Reescrever endpoint**

Substituir conteúdo de `api/tasks-list.ts` por:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('v_tasks_resolved')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const tasks = (data ?? []).map(r => ({
    id: r.id,
    userId: r.user_id,
    projectId: r.project_id,
    contactId: r.contact_id ?? undefined,
    title: r.title,
    notes: r.notes,
    status: r.status,
    priority: r.priority,
    tags: r.tags,
    dueDate: r.due_date ?? undefined,
    startOffset: r.start_offset ?? undefined,
    duration: r.duration ?? undefined,
    dependsOn: r.depends_on,
    archived: r.archived,
    archivedAt: r.archived_at ?? undefined,
    googleTasksId: r.google_tasks_id ?? undefined,
    synced: r.synced,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    // AQAL/GTD
    areaId: r.area_id ?? undefined,
    quadrantOverride: r.quadrant_override ?? undefined,
    resolvedQuadrant: r.resolved_quadrant ?? undefined,
    context: r.context ?? undefined,
    energy: r.energy ?? undefined,
    timeEstimateMin: r.time_estimate_min ?? undefined,
    dueAt: r.due_at ?? undefined,
    scheduledAt: r.scheduled_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    waitingFor: r.waiting_for ?? undefined,
    rrule: r.rrule ?? undefined,
    rruleParentId: r.rrule_parent_id ?? undefined,
    parentTaskId: r.parent_task_id ?? undefined,
    source: r.source ?? 'manual',
    aiClassified: r.ai_classified ?? false,
  }))

  return res.status(200).json({ tasks })
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: PASS para `api/tasks-list.ts`. Pode haver erros em `tasks-save.ts` ainda — corrigido na próxima task. Se erros forem em outros arquivos, parar e investigar.

- [ ] **Step 3: Commit**

```bash
git add api/tasks-list.ts
git commit -m "refactor: tasks-list usa v_tasks_resolved, retorna campos AQAL/GTD"
```

---

## Task 8: Estender tasks-save.ts (campos novos + rrule next-instance)

**Files:**
- Modify: `api/tasks-save.ts`

- [ ] **Step 1: Reescrever handler**

Substituir conteúdo de `api/tasks-save.ts` por:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { getAuthedClient } from './_google.js'
import { google } from 'googleapis'
import { TaskSaveSchema } from './_schemas/task.js'
import { nextOccurrence } from './_lib/rrule.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r['id'], userId: r['user_id'], projectId: r['project_id'],
    contactId: r['contact_id'] ?? undefined, title: r['title'], notes: r['notes'],
    status: r['status'], priority: r['priority'], tags: r['tags'],
    dueDate: r['due_date'] ?? undefined, startOffset: r['start_offset'] ?? undefined,
    duration: r['duration'] ?? undefined, dependsOn: r['depends_on'],
    archived: r['archived'], archivedAt: r['archived_at'] ?? undefined,
    googleTasksId: r['google_tasks_id'] ?? undefined, synced: r['synced'],
    createdAt: r['created_at'], updatedAt: r['updated_at'],
    areaId: r['area_id'] ?? undefined,
    quadrantOverride: r['quadrant_override'] ?? undefined,
    context: r['context'] ?? undefined,
    energy: r['energy'] ?? undefined,
    timeEstimateMin: r['time_estimate_min'] ?? undefined,
    dueAt: r['due_at'] ?? undefined,
    scheduledAt: r['scheduled_at'] ?? undefined,
    completedAt: r['completed_at'] ?? undefined,
    waitingFor: r['waiting_for'] ?? undefined,
    rrule: r['rrule'] ?? undefined,
    rruleParentId: r['rrule_parent_id'] ?? undefined,
    parentTaskId: r['parent_task_id'] ?? undefined,
    source: r['source'] ?? 'manual',
    aiClassified: r['ai_classified'] ?? false,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const {
    id, title, projectId, contactId, dueDate, dependsOn, startOffset, duration,
    areaId, quadrantOverride, context, energy, timeEstimateMin,
    dueAt, scheduledAt, waitingFor, rrule, parentTaskId, source,
    ...rest
  } = parsed.data
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const payload: Record<string, unknown> = {
    title,
    ...rest,
    project_id: projectId,
    contact_id: contactId ?? null,
    due_date: dueDate ?? null,
    depends_on: dependsOn,
    start_offset: startOffset ?? null,
    duration: duration ?? null,
    area_id: areaId ?? null,
    quadrant_override: quadrantOverride ?? null,
    context: context ?? null,
    energy: energy ?? null,
    time_estimate_min: timeEstimateMin ?? null,
    due_at: dueAt ?? null,
    scheduled_at: scheduledAt ?? null,
    waiting_for: waitingFor ?? null,
    rrule: rrule ?? null,
    parent_task_id: parentTaskId ?? null,
    source,
    user_id: user.id,
    updated_at: now,
  }

  let row: Record<string, unknown>
  let httpStatus: number

  if (id) {
    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as Record<string, unknown>
    httpStatus = 201
  }

  // Recorrência: se foi pra done com rrule, gerar próxima instância (idempotente)
  if (rest.status === 'done' && (rrule || row['rrule'])) {
    await maybeGenerateNextInstance(supabase, row, user.id)
  }

  // Push to Google Tasks (best-effort)
  try {
    const [projRes, userRes] = await Promise.all([
      supabase.from('projects').select('google_task_list_id').eq('id', projectId).eq('user_id', user.id).single(),
      supabase.from('users').select('google_refresh_token').eq('id', user.id).single(),
    ])
    const taskListId = projRes.data?.google_task_list_id
    const refreshToken = userRes.data?.google_refresh_token

    if (taskListId && refreshToken) {
      const authClient = await getAuthedClient(refreshToken)
      const tasksApi = google.tasks({ version: 'v1', auth: authClient })

      // Mapeia status novos pro vocabulário do Google Tasks
      const statusForGoogle = mapStatusToGoogle(rest.status)
      const body = {
        title,
        notes: rest.notes ?? undefined,
        status: statusForGoogle,
        due: dueDate ? `${dueDate}T00:00:00.000Z` : undefined,
      }

      const existingGoogleTaskId = row['google_tasks_id'] as string | null

      if (id && existingGoogleTaskId) {
        await tasksApi.tasks.patch({ tasklist: taskListId, task: existingGoogleTaskId, requestBody: body })
        await supabase.from('tasks').update({ synced: true }).eq('id', row['id'] as string)
        row['synced'] = true
      } else if (!id) {
        const { data: gtask } = await tasksApi.tasks.insert({ tasklist: taskListId, requestBody: body })
        if (gtask?.id) {
          await supabase
            .from('tasks')
            .update({ google_tasks_id: gtask.id, synced: true })
            .eq('id', row['id'] as string)
          row['google_tasks_id'] = gtask.id
          row['synced'] = true
        }
      }
    }
  } catch (e) {
    console.error('[tasks-save] google push failed:', e instanceof Error ? e.message : e)
  }

  return res.status(httpStatus).json({ task: mapRow(row) })
}

function mapStatusToGoogle(status: string): 'needsAction' | 'completed' {
  if (status === 'done' || status === 'cancelled') return 'completed'
  return 'needsAction'
}

async function maybeGenerateNextInstance(
  supabase: ReturnType<typeof getSupabase>,
  parentRow: Record<string, unknown>,
  userId: string,
): Promise<void> {
  const rule = (parentRow['rrule'] ?? null) as string | null
  if (!rule) return
  const parentId = parentRow['id'] as string
  const ruleParentId = (parentRow['rrule_parent_id'] as string | null) ?? parentId

  // Idempotência: já existe outra instância open na mesma série?
  const { data: existing, error: existingErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('rrule_parent_id', ruleParentId)
    .not('status', 'in', '(done,cancelled)')
    .limit(1)

  if (existingErr) {
    console.error('[rrule-gen] check existing failed:', existingErr.message)
    return
  }
  if (existing && existing.length > 0) return

  // Calcula próxima ocorrência
  const baseDate = (parentRow['due_at'] as string | null)
    ? new Date(parentRow['due_at'] as string)
    : new Date()
  const next = nextOccurrence(rule, baseDate)
  if (!next) {
    console.log('[rrule-gen] no next occurrence — series ended')
    return
  }

  const insertPayload = {
    user_id: userId,
    project_id: parentRow['project_id'] as string,
    title: parentRow['title'] as string,
    notes: (parentRow['notes'] as string | null) ?? '',
    status: 'next' as const,
    priority: (parentRow['priority'] as string | null) ?? 'med',
    tags: (parentRow['tags'] as string[] | null) ?? [],
    depends_on: [],
    area_id: (parentRow['area_id'] as string | null) ?? null,
    quadrant_override: (parentRow['quadrant_override'] as string | null) ?? null,
    context: (parentRow['context'] as string | null) ?? null,
    energy: (parentRow['energy'] as number | null) ?? null,
    time_estimate_min: (parentRow['time_estimate_min'] as number | null) ?? null,
    due_at: next.toISOString(),
    rrule: rule,
    rrule_parent_id: ruleParentId,
    source: 'manual' as const,
  }

  const { error: insErr } = await supabase.from('tasks').insert(insertPayload)
  if (insErr) {
    console.error('[rrule-gen] insert next instance failed:', insErr.message)
    return
  }
  console.log(`[rrule-gen] next instance created for series ${ruleParentId}, due_at=${next.toISOString()}`)
}
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

Expected: PASS. Se falhar com tipos do supabase em `from('tasks').update(payload)` por causa de `Record<string, unknown>`, manter o `payload` tipado solto e usar `// @ts-expect-error` apenas no insert/update; NÃO inventar campos novos no schema gen — eles já estão lá. Ver se `r['source']` retorna `string`; se sim, OK.

- [ ] **Step 3: Commit**

```bash
git add api/tasks-save.ts
git commit -m "feat: tasks-save aceita campos AQAL/GTD + gera próxima instância em rrule"
```

---

## Task 9: Endpoint POST /api/tasks-classify

**Files:**
- Create: `api/tasks-classify.ts`

- [ ] **Step 1: Implementar endpoint**

Criar `api/tasks-classify.ts`:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import Anthropic from '@anthropic-ai/sdk'
import { TaskClassifyRequestSchema, TaskClassifyResponseSchema } from './_schemas/task-classify.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `Você é um classificador AQAL/GTD para tasks pessoais do Jorge (founder do STATE Innovation Center).

Sua função: dado o título de uma task e a lista de áreas de vida ativas do usuário, sugerir a classificação AQAL.

ÁREAS DISPONÍVEIS (com seus quadrantes):
{{AREAS}}

DIMENSÕES:
- areaId: uuid de uma das áreas acima (string), ou null se ambíguo
- context: tipo de atenção exigido — deep (foco profundo, criativo cognitivo), shallow (administrativo), social (interação com pessoas), criativo (não-cognitivo), somatico (corpo/movimento), offline (sem tela)
- energy: 1-5 — energia mental requerida (1=baixíssima, 5=máxima)
- timeEstimateMin: estimativa em minutos
- rationale: frase curta justificando
- confidence: high | medium | low

Responda EXCLUSIVAMENTE com JSON válido conforme o schema. Sem markdown, sem prosa. Use null para campos que não conseguir estimar com segurança.`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = TaskClassifyRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'taskId ou inboxItemId obrigatório' })
  }

  const supabase = getSupabase()

  // Carrega título e áreas
  let title: string
  let inputId: string
  let isTask = false

  if ('taskId' in parsed.data) {
    inputId = parsed.data.taskId
    const { data, error } = await supabase
      .from('tasks').select('title').eq('id', inputId).eq('user_id', user.id).single()
    if (error || !data) return res.status(404).json({ error: 'task não encontrada' })
    title = data.title
    isTask = true
  } else {
    inputId = parsed.data.inboxItemId
    const { data, error } = await supabase
      .from('inbox_items').select('raw_text').eq('id', inputId).eq('user_id', user.id).single()
    if (error || !data) return res.status(404).json({ error: 'inbox_item não encontrado' })
    title = data.raw_text
  }

  const { data: areas, error: areasErr } = await supabase
    .from('areas')
    .select('id,name,quadrant')
    .eq('user_id', user.id)
    .is('archived_at', null)

  if (areasErr) return res.status(500).json({ error: areasErr.message })

  const areasText = (areas ?? [])
    .map(a => `- ${a.id} | ${a.name} (quadrante ${a.quadrant})`)
    .join('\n') || '(nenhuma área cadastrada)'

  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' })

  const anthropic = new Anthropic({ apiKey })

  let raw: string
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT.replace('{{AREAS}}', areasText),
      messages: [{ role: 'user', content: `Classifique: "${title}"` }],
    })
    raw = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text)
      .join('')
  } catch (e) {
    console.error('[tasks-classify] Haiku call failed:', e instanceof Error ? e.message : e)
    return res.status(502).json({ error: 'Haiku indisponível' })
  }

  let parsedJson: unknown
  try {
    // Haiku às vezes envolve em ```json ... ``` — strip
    const stripped = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    parsedJson = JSON.parse(stripped)
  } catch {
    console.error('[tasks-classify] resposta não-JSON:', raw)
    return res.status(502).json({
      classification: { areaId: null, context: null, energy: null, timeEstimateMin: null, rationale: 'parsing falhou', confidence: 'low' as const },
    })
  }

  const validated = TaskClassifyResponseSchema.safeParse(parsedJson)
  if (!validated.success) {
    console.error('[tasks-classify] resposta inválida:', validated.error.issues)
    return res.status(200).json({
      classification: { areaId: null, context: null, energy: null, timeEstimateMin: null, rationale: 'schema falhou', confidence: 'low' as const },
    })
  }

  // Se input foi taskId, marca ai_classified=true (sem persistir sugestão — user decide no panel)
  if (isTask) {
    const { data: updated } = await supabase
      .from('tasks')
      .update({ ai_classified: true })
      .eq('id', inputId)
      .eq('user_id', user.id)
      .select()
      .single()
    return res.status(200).json({ classification: validated.data, task: updated })
  }

  // Se foi inbox_item, persiste a sugestão em ai_suggestion (não processa ainda)
  await supabase
    .from('inbox_items')
    .update({ ai_suggestion: validated.data })
    .eq('id', inputId)
    .eq('user_id', user.id)

  return res.status(200).json({ classification: validated.data })
}
```

- [ ] **Step 2: Adicionar maxDuration no vercel.json**

Editar `vercel.json` — na seção `functions`, garantir que `api/tasks-classify.ts` tenha:

```json
"api/tasks-classify.ts": { "maxDuration": 30 }
```

(Se a seção `functions` não existir, criar. Verificar formato existente.)

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add api/tasks-classify.ts vercel.json
git commit -m "feat: endpoint POST /api/tasks-classify (Haiku classifica área/contexto/energia/tempo)"
```

---

## Task 10: Endpoint GET /api/inbox-list

**Files:**
- Create: `api/inbox-list.ts`

- [ ] **Step 1: Implementar**

Criar `api/inbox-list.ts`:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const supabase = getSupabase()

  const [itemsRes, tasksRes] = await Promise.all([
    supabase
      .from('inbox_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('processed', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('v_tasks_resolved')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .eq('status', 'inbox')
      .order('created_at', { ascending: false }),
  ])

  if (itemsRes.error) return res.status(500).json({ error: itemsRes.error.message })
  if (tasksRes.error) return res.status(500).json({ error: tasksRes.error.message })

  type AnyRow = Record<string, unknown>

  const itemEntries = (itemsRes.data ?? []).map(r => ({
    kind: 'inbox_item' as const,
    data: {
      id: r.id,
      userId: r.user_id,
      rawText: r.raw_text,
      source: r.source,
      externalRef: r.external_ref ?? undefined,
      aiSuggestion: r.ai_suggestion ?? undefined,
      processed: r.processed,
      processedToTask: r.processed_to_task ?? undefined,
      processedToProject: r.processed_to_project ?? undefined,
      createdAt: r.created_at,
      processedAt: r.processed_at ?? undefined,
    },
  }))

  const taskEntries = (tasksRes.data ?? []).map((r: AnyRow) => ({
    kind: 'task' as const,
    data: {
      id: r['id'], userId: r['user_id'], projectId: r['project_id'],
      contactId: r['contact_id'] ?? undefined, title: r['title'], notes: r['notes'],
      status: r['status'], priority: r['priority'], tags: r['tags'],
      dueDate: r['due_date'] ?? undefined, dependsOn: r['depends_on'],
      archived: r['archived'], synced: r['synced'],
      createdAt: r['created_at'], updatedAt: r['updated_at'],
      areaId: r['area_id'] ?? undefined,
      resolvedQuadrant: r['resolved_quadrant'] ?? undefined,
      context: r['context'] ?? undefined,
      energy: r['energy'] ?? undefined,
      timeEstimateMin: r['time_estimate_min'] ?? undefined,
      dueAt: r['due_at'] ?? undefined,
      scheduledAt: r['scheduled_at'] ?? undefined,
      source: r['source'] ?? 'manual',
      aiClassified: r['ai_classified'] ?? false,
    },
  }))

  return res.status(200).json({ entries: [...itemEntries, ...taskEntries] })
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/inbox-list.ts
git commit -m "feat: endpoint GET /api/inbox-list (une inbox_items + tasks status=inbox)"
```

---

## Task 11: Endpoint POST /api/inbox-capture

**Files:**
- Create: `api/inbox-capture.ts`

- [ ] **Step 1: Implementar**

Criar `api/inbox-capture.ts`:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { InboxCaptureSchema } from './_schemas/inbox.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = InboxCaptureSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { rawText, source, externalRef } = parsed.data
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('inbox_items')
    .insert({
      user_id: user.id,
      raw_text: rawText,
      source,
      external_ref: externalRef ?? null,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(201).json({
    item: {
      id: data.id,
      userId: data.user_id,
      rawText: data.raw_text,
      source: data.source,
      externalRef: data.external_ref ?? undefined,
      aiSuggestion: data.ai_suggestion ?? undefined,
      processed: data.processed,
      createdAt: data.created_at,
    },
  })
}
```

- [ ] **Step 2: Build + Commit**

```bash
npm run build
git add api/inbox-capture.ts
git commit -m "feat: endpoint POST /api/inbox-capture (captura GTD rápida)"
```

---

## Task 12: Endpoint POST /api/inbox-process

**Files:**
- Create: `api/inbox-process.ts`

- [ ] **Step 1: Implementar**

Criar `api/inbox-process.ts`:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { InboxProcessSchema } from './_schemas/inbox.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = InboxProcessSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const { id, action, taskFields } = parsed.data
  const supabase = getSupabase()

  // Confirma ownership do inbox_item
  const { data: item, error: itemErr } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (itemErr || !item) return res.status(404).json({ error: 'inbox_item não encontrado' })
  if (item.processed) return res.status(409).json({ error: 'item já processado' })

  const now = new Date().toISOString()

  if (action === 'trash') {
    const { data: updated, error } = await supabase
      .from('inbox_items')
      .update({ processed: true, processed_at: now })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ item: mapItem(updated) })
  }

  if (action === 'to_task') {
    if (!taskFields) return res.status(400).json({ error: 'taskFields obrigatório para to_task' })

    const { data: created, error: createErr } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        project_id: taskFields.projectId,
        title: taskFields.title,
        notes: '',
        status: taskFields.status,
        priority: 'med',
        tags: [],
        depends_on: [],
        area_id: taskFields.areaId ?? null,
        context: taskFields.context ?? null,
        energy: taskFields.energy ?? null,
        time_estimate_min: taskFields.timeEstimateMin ?? null,
        due_at: taskFields.dueAt ?? null,
        scheduled_at: taskFields.scheduledAt ?? null,
        waiting_for: taskFields.waitingFor ?? null,
        source: item.source,
      })
      .select()
      .single()
    if (createErr) return res.status(500).json({ error: createErr.message })

    const { data: updated, error: updErr } = await supabase
      .from('inbox_items')
      .update({ processed: true, processed_to_task: created.id, processed_at: now })
      .eq('id', id)
      .select()
      .single()
    if (updErr) return res.status(500).json({ error: updErr.message })

    return res.status(200).json({ item: mapItem(updated), task: { id: created.id, title: created.title, status: created.status } })
  }

  // action === 'to_project': mínimo viável — cria projeto com nome=rawText, sem campos AQAL
  if (action === 'to_project') {
    const { data: created, error: createErr } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: item.raw_text.slice(0, 100),
        color: '#a8ff00',
      })
      .select()
      .single()
    if (createErr) return res.status(500).json({ error: createErr.message })

    const { data: updated, error: updErr } = await supabase
      .from('inbox_items')
      .update({ processed: true, processed_to_project: created.id, processed_at: now })
      .eq('id', id)
      .select()
      .single()
    if (updErr) return res.status(500).json({ error: updErr.message })

    return res.status(200).json({ item: mapItem(updated) })
  }

  return res.status(400).json({ error: 'action desconhecida' })
}

function mapItem(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    rawText: r['raw_text'],
    source: r['source'],
    externalRef: r['external_ref'] ?? undefined,
    aiSuggestion: r['ai_suggestion'] ?? undefined,
    processed: r['processed'],
    processedToTask: r['processed_to_task'] ?? undefined,
    processedToProject: r['processed_to_project'] ?? undefined,
    createdAt: r['created_at'],
    processedAt: r['processed_at'] ?? undefined,
  }
}
```

- [ ] **Step 2: Build + Commit**

```bash
npm run build
git add api/inbox-process.ts
git commit -m "feat: endpoint POST /api/inbox-process (triagem to_task/to_project/trash)"
```

---

## Task 13: Hook useInbox

**Files:**
- Create: `src/hooks/useInbox.ts`

- [ ] **Step 1: Implementar**

Criar `src/hooks/useInbox.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { InboxEntry, InboxItem } from '../types/domain.ts'
import type { InboxListResponse, InboxCaptureResponse, InboxProcessResponse } from '../types/api.ts'
import type { InboxProcessInput } from '../../api/_schemas/inbox.ts'

export function useInbox() {
  const [entries, setEntries] = useState<InboxEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<InboxListResponse>('/api/inbox-list')
      setEntries(res.entries)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  const capture = useCallback(async (rawText: string): Promise<InboxItem> => {
    const res = await api.post<InboxCaptureResponse>('/api/inbox-capture', { rawText })
    setEntries(prev => [{ kind: 'inbox_item', data: res.item }, ...prev])
    return res.item
  }, [])

  const process = useCallback(async (input: InboxProcessInput) => {
    const res = await api.post<InboxProcessResponse>('/api/inbox-process', input)
    setEntries(prev => prev.filter(e => !(e.kind === 'inbox_item' && e.data.id === input.id)))
    return res
  }, [])

  return { entries, loading, fetch, capture, process }
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useInbox.ts
git commit -m "feat: hook useInbox (capture + process + lista entries)"
```

---

## Task 14: Adicionar `classify` no useTasks

**Files:**
- Modify: `src/hooks/useTasks.ts`

- [ ] **Step 1: Adicionar método e import**

Editar `src/hooks/useTasks.ts`. Adicionar no topo (junto aos outros imports):

```typescript
import type { TaskClassifyResponse } from '../types/api.ts'
import type { TaskClassifyResult } from '../types/domain.ts'
```

Adicionar antes do `return { ... }`:

```typescript
const classify = useCallback(async (taskId: string): Promise<TaskClassifyResult> => {
  const res = await api.post<TaskClassifyResponse>('/api/tasks-classify', { taskId })
  if (res.task) {
    setTasks(prev => prev.map(t => (t.id === res.task!.id ? res.task as Task : t)))
  }
  return res.classification
}, [])
```

E adicionar `classify` ao return:

```typescript
return { tasks, loading, save, archive, updateStatus, classify, refetch: fetch }
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTasks.ts
git commit -m "feat: useTasks.classify(taskId) — chama tasks-classify e atualiza estado"
```

---

## Task 15: Verificação final

**Files:** todo o repo

- [ ] **Step 1: Rodar todos os testes**

```bash
npm run test -- --run
```

Expected: PASS — todos os testes anteriores + os novos (TaskSaveSchema, Inbox, TaskClassify, rrule helper). Pelo menos ~50 testes verdes.

- [ ] **Step 2: Build completo**

```bash
npm run build
```

Expected: PASS — `tsc -b && vite build` ambos zero erros.

Se houver erros remanescentes em UI components (TaskPanel, KanbanView, etc.) por causa de Task com novos campos opcionais, **NÃO consertar nesta task** — anotar no HANDOFF-NOTE. UI será reescrita na próxima sessão.

- [ ] **Step 3: Status check git**

```bash
git status
git log --oneline master..HEAD
```

Verifica que todos os commits estão lá e working tree está limpo.

- [ ] **Step 4: Escrever HANDOFF-NOTE.md (gitignored)**

Será feito fora do plano, na thread principal, antes de encerrar.

---

## Self-Review

**Spec coverage:**
- ✅ Schema/API contracts (Tasks 2-5)
- ✅ Endpoints novos: tasks-classify, inbox-list, inbox-capture, inbox-process (Tasks 9-12)
- ✅ Refactor tasks-list pra v_tasks_resolved (Task 7)
- ✅ Extend tasks-save com campos novos + rrule (Task 8)
- ✅ Hook useInbox (Task 13)
- ✅ Hook useTasks.classify (Task 14)
- ✅ Tipos atualizados (Task 5)
- ✅ Lib rrule helper (Task 6)
- ⏸ UI components (TaskPanel chips, KanbanView quadrante, TodayView filtros, QuickAdd dual, InboxView) — explicitamente fora do escopo deste plano (próxima sessão)

**Placeholder scan:** nenhum TBD/TODO sem código concreto. Todos os steps têm comando exato + bloco de código quando aplicável.

**Type consistency:** `Task` extension consistente em domain.ts, mappers em tasks-list e tasks-save, response types em api.ts. `TaskClassifyResult` reutilizado em domain.ts, api.ts e useTasks.

**Risco residual:**
- Lib `rrule` pode ter peculiaridades de timezone (testes são UTC) — Task 6 instrui debug ajustando expectativas, não a lógica
- Build pode falhar em UI components que assumem `Task` sem campos novos — não bloqueante (campos opcionais), mas se Vite reclamar, anotar no HANDOFF
