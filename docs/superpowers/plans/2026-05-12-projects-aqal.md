# Projects AQAL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Projects AQAL CRUD completo conforme spec `docs/superpowers/specs/2026-05-12-projects-aqal-design.md` — backend, hooks, página `/projects`, integração com TaskPanel/TasksPage/Dashboard.

**Architecture:** Aditiva ao schema 0010 + nova view 0012. Endpoints novos seguem padrão dos existentes. UI nova reusa Chip/Popover do TaskPanel. Hierarquia 1-nível enforced no handler.

**Tech Stack:** TypeScript strict, Zod 3, Vitest 3, React 19, Supabase JS (view nova), CSS variables existentes.

---

## File Structure

**Criar:**
- `supabase/migrations/0012_projects_view.sql` — view v_projects_with_counts
- `api/_schemas/project.ts` — ProjectSaveSchema, archive/complete schemas
- `api/_schemas/project.test.ts` — testes Zod
- `api/projects-save.ts` — POST/PATCH endpoint
- `api/projects-archive.ts` — POST endpoint
- `api/projects-complete.ts` — POST endpoint
- `src/components/projects/ProjectRow.tsx` — linha de projeto
- `src/components/projects/ProjectPanel.tsx` — overlay edição (chips inline)
- `src/components/projects/ProjectsView.tsx` — lista com agrupamento
- `src/components/projects/ProjectsCard.tsx` — top 5 ativos pra Dashboard
- `src/pages/ProjectsPage.tsx` — página /projects standalone

**Modificar:**
- `src/types/database.ts` — adicionar `v_projects_with_counts` view (manual fallback se db:types não rodar)
- `src/types/domain.ts` — Project com campos AQAL completos + agregados
- `src/types/api.ts` — ProjectSaveResponse
- `api/projects-list.ts` — usar view, filtro ?status=
- `src/hooks/useProjects.ts` — extend com save/archive/complete + opts
- `src/hooks/AuthProvider.tsx` ou similar — não muda (sanity check)
- `src/App.tsx` — rota /projects nova
- `src/pages/TasksPage.tsx` — tab "Projetos"
- `src/pages/DashboardPage.tsx` — ProjectsCard
- `src/components/tasks/TaskPanel.tsx` — popover Project com "+ novo"
- `src/components/tasks/TaskRow.tsx` — dot de cor do projeto
- `dev-server.ts` — registrar projects-save/archive/complete
- `src/styles/globals.css` — estilos novos

---

## Task 1: Migration 0012 — view v_projects_with_counts

**Files:**
- Create: `supabase/migrations/0012_projects_view.sql`

- [ ] **Step 1: Criar migration**

Criar `supabase/migrations/0012_projects_view.sql`:

```sql
-- =============================================================
-- Migration 0012 — view v_projects_with_counts
-- Projects + agregados (task counts, child counts, resolved quadrant)
-- =============================================================

create or replace view public.v_projects_with_counts as
select
  p.*,
  coalesce((
    select count(*) from public.tasks t
    where t.project_id = p.id and t.archived = false and t.status not in ('done','cancelled')
  ), 0) as task_open_count,
  coalesce((
    select count(*) from public.tasks t
    where t.project_id = p.id and t.archived = false
  ), 0) as task_count,
  coalesce((
    select count(*) from public.projects c
    where c.parent_id = p.id and c.archived_at is null
  ), 0) as child_count,
  coalesce(p.quadrant_override, a.quadrant) as resolved_quadrant
from public.projects p
left join public.areas a on a.id = p.area_id;

comment on view public.v_projects_with_counts is
  'Projects + task counts + child count + resolved quadrant (override > area)';
```

- [ ] **Step 2: Aplicar migration no Supabase (supondo que user faz isso manualmente)**

Migration é idempotente (`create or replace view`). Pode rodar via Supabase Studio (SQL Editor) ou `supabase db push` se CLI configurado.

**IMPORTANTE:** Anotar pra user aplicar antes do deploy. Implementação dos endpoints assume que view existe.

- [ ] **Step 3: Atualizar src/types/database.ts manualmente (fallback se db:types não disponível)**

Após `Views: { v_tasks_resolved: ... }` em `src/types/database.ts`, adicionar antes do fechamento de `Views: { ... }`:

```typescript
      v_projects_with_counts: {
        Row: Database['public']['Tables']['projects']['Row'] & {
          task_open_count: number
          task_count: number
          child_count: number
          resolved_quadrant: Quadrant | null
        }
        Relationships: []
      }
```

Verificar a indentação match do que está no arquivo (8 espaços antes de `v_projects_with_counts:`).

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: PASS. Se falhar com erro de tipo na view, revisar a indentação/estrutura no Step 3.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0012_projects_view.sql src/types/database.ts
git commit -m "feat: migration 0012 + types view v_projects_with_counts (projects + agregados)"
```

---

## Task 2: Schema Zod ProjectSaveSchema (TDD)

**Files:**
- Create: `api/_schemas/project.ts`
- Test: `api/_schemas/project.test.ts`

- [ ] **Step 1: Escrever testes failing**

Criar `api/_schemas/project.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { ProjectSaveSchema, ProjectArchiveSchema, ProjectCompleteSchema } from './project.js'

const baseValid = { name: 'P1' }

describe('ProjectSaveSchema', () => {
  describe('name', () => {
    it('aceita name não-vazio', () => {
      expect(ProjectSaveSchema.safeParse(baseValid).success).toBe(true)
    })
    it('rejeita name vazio', () => {
      expect(ProjectSaveSchema.safeParse({ name: '' }).success).toBe(false)
    })
    it('rejeita name acima de 200 chars', () => {
      expect(ProjectSaveSchema.safeParse({ name: 'x'.repeat(201) }).success).toBe(false)
    })
  })

  describe('color', () => {
    it('default é #7dd3fc', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.color).toBe('#7dd3fc')
    })
    it('aceita hex válido', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, color: '#abc' }).success).toBe(true)
    })
    it('rejeita string sem #', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, color: 'red' }).success).toBe(false)
    })
  })

  describe('kind', () => {
    it('default é outcome', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.kind).toBe('outcome')
    })
    it('aceita outcome e evergreen', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, kind: 'outcome' }).success).toBe(true)
      expect(ProjectSaveSchema.safeParse({ ...baseValid, kind: 'evergreen' }).success).toBe(true)
    })
    it('rejeita outros valores', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, kind: 'project' }).success).toBe(false)
    })
  })

  describe('status', () => {
    it('default é active', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.status).toBe('active')
    })
    it('aceita 5 valores', () => {
      for (const s of ['active','on_hold','someday','done','archived'] as const) {
        expect(ProjectSaveSchema.safeParse({ ...baseValid, status: s }).success).toBe(true)
      }
    })
    it('rejeita inválido', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, status: 'pending' }).success).toBe(false)
    })
  })

  describe('horizon', () => {
    it('default é H1', () => {
      const r = ProjectSaveSchema.safeParse(baseValid)
      if (r.success) expect(r.data.horizon).toBe('H1')
    })
    it('aceita H0..H5', () => {
      for (const h of ['H0','H1','H2','H3','H4','H5'] as const) {
        expect(ProjectSaveSchema.safeParse({ ...baseValid, horizon: h }).success).toBe(true)
      }
    })
    it('rejeita H6', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, horizon: 'H6' }).success).toBe(false)
    })
  })

  describe('AQAL fields', () => {
    const uuid = '00000000-0000-0000-0000-000000000001'
    it('aceita areaId UUID', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, areaId: uuid }).success).toBe(true)
    })
    it('rejeita areaId não-UUID', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, areaId: 'abc' }).success).toBe(false)
    })
    it('aceita quadrantOverride válido', () => {
      for (const q of ['I','IT','WE','ITS'] as const) {
        expect(ProjectSaveSchema.safeParse({ ...baseValid, quadrantOverride: q }).success).toBe(true)
      }
    })
    it('aceita parentId UUID', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, parentId: uuid }).success).toBe(true)
    })
  })

  describe('targetDate', () => {
    it('aceita YYYY-MM-DD', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, targetDate: '2026-05-20' }).success).toBe(true)
    })
    it('rejeita ISO datetime', () => {
      expect(ProjectSaveSchema.safeParse({ ...baseValid, targetDate: '2026-05-20T15:00:00Z' }).success).toBe(false)
    })
  })
})

describe('ProjectArchiveSchema', () => {
  it('exige id UUID', () => {
    expect(ProjectArchiveSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    expect(ProjectArchiveSchema.safeParse({}).success).toBe(false)
    expect(ProjectArchiveSchema.safeParse({ id: 'abc' }).success).toBe(false)
  })
})

describe('ProjectCompleteSchema', () => {
  it('exige id UUID', () => {
    expect(ProjectCompleteSchema.safeParse({ id: '00000000-0000-0000-0000-000000000001' }).success).toBe(true)
    expect(ProjectCompleteSchema.safeParse({}).success).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar — FAIL (módulo não existe)**

```bash
npm run test -- --run api/_schemas/project.test.ts
```

Expected: FAIL com "Cannot find module './project'".

- [ ] **Step 3: Implementar schema**

Criar `api/_schemas/project.ts`:

```typescript
import { z } from 'zod'

export const ProjectSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  title: z.string().optional(),
  outcome: z.string().optional(),
  color: z.string().regex(/^#/).default('#7dd3fc'),
  kind: z.enum(['outcome', 'evergreen']).default('outcome'),
  status: z.enum(['active', 'on_hold', 'someday', 'done', 'archived']).default('active'),
  horizon: z.enum(['H0', 'H1', 'H2', 'H3', 'H4', 'H5']).default('H1'),
  areaId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  quadrantOverride: z.enum(['I', 'IT', 'WE', 'ITS']).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  position: z.number().int().default(0),
})

export type ProjectSaveInput = z.input<typeof ProjectSaveSchema>
export type ProjectSaveOutput = z.output<typeof ProjectSaveSchema>

export const ProjectArchiveSchema = z.object({
  id: z.string().uuid(),
})
export type ProjectArchiveInput = z.infer<typeof ProjectArchiveSchema>

export const ProjectCompleteSchema = z.object({
  id: z.string().uuid(),
})
export type ProjectCompleteInput = z.infer<typeof ProjectCompleteSchema>
```

- [ ] **Step 4: Rodar — PASS**

```bash
npm run test -- --run api/_schemas/project.test.ts
```

Expected: PASS — todos os ~22 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add api/_schemas/project.ts api/_schemas/project.test.ts
git commit -m "feat: ProjectSaveSchema com campos AQAL (kind/status/horizon/area/parent/target)"
```

---

## Task 3: Tipos Project + Response

**Files:**
- Modify: `src/types/domain.ts`
- Modify: `src/types/api.ts`

- [ ] **Step 1: Estender Project em domain.ts**

Em `src/types/domain.ts`, **substituir** o bloco `export interface Project { ... }` (atualmente ~10 linhas) por:

```typescript
export interface Project {
  id: string
  userId: string
  name: string
  color: string
  googleTaskListId?: string
  archived: boolean
  createdAt: string
  updatedAt: string
  // AQAL (campos novos opcionais — vêm da view v_projects_with_counts)
  title?: string
  outcome?: string
  kind: ProjectKind
  status: ProjectStatusType
  horizon: HorizonLvl
  areaId?: string
  parentId?: string
  quadrantOverride?: Quadrant
  resolvedQuadrant?: Quadrant
  targetDate?: string
  position: number
  completedAt?: string
  archivedAt?: string
  // Agregados (preenchidos pelo endpoint, não enviados no save)
  taskCount: number
  taskOpenCount: number
  childCount: number
}
```

- [ ] **Step 2: Adicionar ProjectSaveResponse em api.ts**

Em `src/types/api.ts`, encontrar a linha `export interface InboxProcessResponse { ... }` e adicionar logo abaixo:

```typescript
export interface ProjectSaveResponse {
  project: Project
}
```

(Note: `Project` já está importado no topo do arquivo via `import type { ... Project ... } from './domain.ts'`).

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: pode falhar em consumers que esperam `Project` simples sem agregados (ex: TasksPage usa `projects[0].id` — OK, ainda compila). Se quebrar em algum lugar, anotar e seguir — Tasks 6+ vão atualizar TasksPage/TaskPanel/TaskRow.

Se erro for em `useProjects.ts` por causa de `setProjects(res.projects)` esperando agregados que talvez não venham antes do refactor do endpoint — endpoint será refatorado em Task 4. Se necessário, marcar `taskCount` etc como opcionais temporariamente:

```typescript
taskCount?: number
taskOpenCount?: number
childCount?: number
```

E ajustar consumidores em Task 5+ pra default 0. **Decisão:** manter como required, fix em Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/types/domain.ts src/types/api.ts
git commit -m "feat: Project type estendido AQAL (kind/status/horizon/area/parent/agregados) + ProjectSaveResponse"
```

---

## Task 4: Refactor projects-list (usa view + agregados)

**Files:**
- Modify: `api/projects-list.ts`

- [ ] **Step 1: Reescrever endpoint**

Substituir conteúdo de `api/projects-list.ts` por:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    name: r['name'],
    color: r['color'],
    googleTaskListId: r['google_task_list_id'] ?? undefined,
    archived: r['archived'],
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
    title: r['title'] ?? undefined,
    outcome: r['outcome'] ?? undefined,
    kind: r['kind'] ?? 'outcome',
    status: r['status_aqal'] ?? 'active',
    horizon: r['horizon'] ?? 'H1',
    areaId: r['area_id'] ?? undefined,
    parentId: r['parent_id'] ?? undefined,
    quadrantOverride: r['quadrant_override'] ?? undefined,
    resolvedQuadrant: r['resolved_quadrant'] ?? undefined,
    targetDate: r['target_date'] ?? undefined,
    position: r['position'] ?? 0,
    completedAt: r['completed_at'] ?? undefined,
    archivedAt: r['archived_at'] ?? undefined,
    taskCount: r['task_count'] ?? 0,
    taskOpenCount: r['task_open_count'] ?? 0,
    childCount: r['child_count'] ?? 0,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const statusFilter = typeof req.query['status'] === 'string' ? req.query['status'] : undefined
  const supabase = getSupabase()

  let query = supabase
    .from('v_projects_with_counts')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (statusFilter === 'archived') {
    query = query.not('archived_at', 'is', null)
  } else if (statusFilter && ['active','on_hold','someday','done'].includes(statusFilter)) {
    query = query.eq('status_aqal', statusFilter).is('archived_at', null)
  } else {
    // default: tudo que não está arquivado
    query = query.is('archived_at', null)
  }

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })

  let projects = (data ?? []).map(r => mapRow(r as unknown as Record<string, unknown>))

  // Garante pelo menos 1 projeto "Inbox" pra primeiro use
  if (projects.length === 0 && !statusFilter) {
    const { data: inbox, error: createErr } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: 'Inbox', color: '#7dd3fc' })
      .select()
      .single()
    if (createErr) return res.status(500).json({ error: createErr.message })
    projects = [{
      id: inbox.id, userId: inbox.user_id, name: inbox.name, color: inbox.color,
      googleTaskListId: undefined, archived: inbox.archived,
      createdAt: inbox.created_at, updatedAt: inbox.updated_at,
      kind: 'outcome' as const, status: 'active' as const, horizon: 'H1' as const,
      position: 0, taskCount: 0, taskOpenCount: 0, childCount: 0,
    }]
  }

  return res.status(200).json({ projects })
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/projects-list.ts
git commit -m "refactor: projects-list usa view v_projects_with_counts (campos AQAL + agregados + filtro status)"
```

---

## Task 5: Endpoint POST/PATCH /api/projects-save

**Files:**
- Create: `api/projects-save.ts`

- [ ] **Step 1: Implementar endpoint**

Criar `api/projects-save.ts`:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ProjectSaveSchema } from './_schemas/project.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    name: r['name'],
    color: r['color'],
    googleTaskListId: r['google_task_list_id'] ?? undefined,
    archived: r['archived'],
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
    title: r['title'] ?? undefined,
    outcome: r['outcome'] ?? undefined,
    kind: r['kind'] ?? 'outcome',
    status: r['status_aqal'] ?? 'active',
    horizon: r['horizon'] ?? 'H1',
    areaId: r['area_id'] ?? undefined,
    parentId: r['parent_id'] ?? undefined,
    quadrantOverride: r['quadrant_override'] ?? undefined,
    resolvedQuadrant: undefined, // não vem da tabela direto
    targetDate: r['target_date'] ?? undefined,
    position: r['position'] ?? 0,
    completedAt: r['completed_at'] ?? undefined,
    archivedAt: r['archived_at'] ?? undefined,
    taskCount: 0,
    taskOpenCount: 0,
    childCount: 0,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ProjectSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'dados inválidos' })
  }

  const d = parsed.data
  const supabase = getSupabase()

  // Validação de hierarquia 1-nível: se parentId fornecido, pai NÃO pode ter parent_id
  if (d.parentId) {
    const { data: parent, error: parentErr } = await supabase
      .from('projects')
      .select('id, parent_id')
      .eq('id', d.parentId)
      .eq('user_id', user.id)
      .single()
    if (parentErr || !parent) {
      return res.status(400).json({ error: 'projeto pai não encontrado' })
    }
    if (parent.parent_id) {
      return res.status(400).json({ error: 'hierarquia limitada a 1 nível (pai não pode ter parent)' })
    }
    if (d.id && d.parentId === d.id) {
      return res.status(400).json({ error: 'projeto não pode ser pai de si mesmo' })
    }
  }

  const now = new Date().toISOString()
  const payload = {
    name: d.name,
    title: d.title ?? null,
    outcome: d.outcome ?? null,
    color: d.color,
    kind: d.kind,
    status_aqal: d.status,
    horizon: d.horizon,
    area_id: d.areaId ?? null,
    parent_id: d.parentId ?? null,
    quadrant_override: d.quadrantOverride ?? null,
    target_date: d.targetDate ?? null,
    position: d.position,
    user_id: user.id,
    updated_at: now,
  }

  let row: Record<string, unknown>
  let httpStatus: number

  if (d.id) {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', d.id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 200
  } else {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    row = data as unknown as Record<string, unknown>
    httpStatus = 201
  }

  return res.status(httpStatus).json({ project: mapRow(row) })
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/projects-save.ts
git commit -m "feat: endpoint POST/PATCH /api/projects-save (com validação hierarquia 1-nível)"
```

---

## Task 6: Endpoints projects-archive + projects-complete

**Files:**
- Create: `api/projects-archive.ts`
- Create: `api/projects-complete.ts`

- [ ] **Step 1: Criar projects-archive**

Criar `api/projects-archive.ts`:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ProjectArchiveSchema } from './_schemas/project.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ProjectArchiveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'id obrigatório' })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('projects')
    .update({
      archived: true,
      archived_at: now,
      status_aqal: 'archived',
      updated_at: now,
    })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step 2: Criar projects-complete**

Criar `api/projects-complete.ts`:

```typescript
import { requireAuth } from './_middleware.js'
import { getSupabase } from './_supabase.js'
import { ProjectCompleteSchema } from './_schemas/project.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function mapRow(r: Record<string, unknown>) {
  return {
    id: r['id'],
    userId: r['user_id'],
    name: r['name'],
    color: r['color'],
    googleTaskListId: r['google_task_list_id'] ?? undefined,
    archived: r['archived'],
    createdAt: r['created_at'],
    updatedAt: r['updated_at'],
    title: r['title'] ?? undefined,
    outcome: r['outcome'] ?? undefined,
    kind: r['kind'] ?? 'outcome',
    status: r['status_aqal'] ?? 'active',
    horizon: r['horizon'] ?? 'H1',
    areaId: r['area_id'] ?? undefined,
    parentId: r['parent_id'] ?? undefined,
    quadrantOverride: r['quadrant_override'] ?? undefined,
    resolvedQuadrant: undefined,
    targetDate: r['target_date'] ?? undefined,
    position: r['position'] ?? 0,
    completedAt: r['completed_at'] ?? undefined,
    archivedAt: r['archived_at'] ?? undefined,
    taskCount: 0,
    taskOpenCount: 0,
    childCount: 0,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'PATCH') return res.status(405).end()

  const user = requireAuth(req, res)
  if (!user) return

  const parsed = ProjectCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'id obrigatório' })
  }

  const supabase = getSupabase()

  const { data: existing, error: fetchErr } = await supabase
    .from('projects')
    .select('id, kind')
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !existing) return res.status(404).json({ error: 'projeto não encontrado' })
  if (existing.kind === 'evergreen') {
    return res.status(400).json({ error: 'projeto evergreen não pode ser marcado concluído' })
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('projects')
    .update({ status_aqal: 'done', completed_at: now, updated_at: now })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ project: mapRow(data as unknown as Record<string, unknown>) })
}
```

- [ ] **Step 3: Atualizar dev-server.ts**

Em `dev-server.ts`, adicionar imports e rotas. Localizar a seção de imports após `import projectsList from './api/projects-list.ts'` e adicionar:

```typescript
import projectsSave from './api/projects-save.ts'
import projectsArchive from './api/projects-archive.ts'
import projectsComplete from './api/projects-complete.ts'
```

E nas rotas, após `app.all('/api/projects-list', h(projectsList))`, adicionar:

```typescript
app.all('/api/projects-save', h(projectsSave))
app.all('/api/projects-archive', h(projectsArchive))
app.all('/api/projects-complete', h(projectsComplete))
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/projects-archive.ts api/projects-complete.ts dev-server.ts
git commit -m "feat: endpoints projects-archive + projects-complete (rejeita complete em evergreen)"
```

---

## Task 7: Hook useProjects extension

**Files:**
- Modify: `src/hooks/useProjects.ts`

- [ ] **Step 1: Reescrever hook**

Substituir conteúdo de `src/hooks/useProjects.ts` por:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.ts'
import type { Project } from '../types/domain.ts'
import type { ProjectsListResponse, ProjectSaveResponse } from '../types/api.ts'
import type { ProjectSaveInput } from '../../api/_schemas/project.ts'

interface Opts {
  includeArchived?: boolean
  status?: 'active' | 'on_hold' | 'someday' | 'done'
}

export function useProjects(opts?: Opts) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (opts?.includeArchived) params.set('status', 'archived')
      else if (opts?.status) params.set('status', opts.status)
      const q = params.toString() ? `?${params.toString()}` : ''
      const res = await api.get<ProjectsListResponse>(`/api/projects-list${q}`)
      setProjects(res.projects)
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [opts?.includeArchived, opts?.status])

  useEffect(() => { void fetch() }, [fetch])

  const save = useCallback(async (input: ProjectSaveInput): Promise<Project> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<ProjectSaveResponse>('/api/projects-save', input)
    setProjects(prev =>
      input.id
        ? prev.map(p => (p.id === res.project.id ? res.project : p))
        : [...prev, res.project]
    )
    return res.project
  }, [])

  const archive = useCallback(async (id: string) => {
    await api.post('/api/projects-archive', { id })
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  const complete = useCallback(async (id: string) => {
    const res = await api.post<ProjectSaveResponse>('/api/projects-complete', { id })
    setProjects(prev => prev.map(p => (p.id === res.project.id ? res.project : p)))
    return res.project
  }, [])

  return { projects, loading, save, archive, complete, refetch: fetch }
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: PASS. Consumidores existentes (`useProjects()` sem args) continuam funcionando.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useProjects.ts
git commit -m "feat: useProjects extend com save/archive/complete + opts (status, includeArchived)"
```

---

## Task 8: ProjectPanel component (chips inline)

**Files:**
- Create: `src/components/projects/ProjectPanel.tsx`

- [ ] **Step 1: Implementar componente**

Criar `src/components/projects/ProjectPanel.tsx`:

```typescript
import { useState, useEffect } from 'react'
import type { Project, Area, HorizonLvl, Quadrant, ProjectKind, ProjectStatusType } from '../../types/domain.ts'
import type { ProjectSaveInput } from '../../../api/_schemas/project.ts'
import { ConfirmDialog } from '../common/ConfirmDialog.tsx'
import { Chip } from '../common/Chip.tsx'
import { IconCalendar, IconPlus } from '../common/Icon.tsx'
import { QUADRANT_COLORS } from '../../types/domain.ts'

const STATUS_LABELS: Record<ProjectStatusType, string> = {
  active: 'ativo', on_hold: 'pausado', someday: 'algum dia', done: 'concluído', archived: 'arquivado',
}
const STATUS_COLORS: Record<ProjectStatusType, string> = {
  active: '#7dd3fc', on_hold: '#9ca3af', someday: '#a78bfa', done: '#34d399', archived: '#64748b',
}
const KIND_LABELS: Record<ProjectKind, string> = { outcome: 'outcome', evergreen: 'evergreen' }
const KIND_COLORS: Record<ProjectKind, string> = { outcome: '#7dd3fc', evergreen: '#9ca3af' }
const HORIZON_LABELS: Record<HorizonLvl, string> = {
  H0: 'H0 · agora', H1: 'H1 · esta semana', H2: 'H2 · trimestre',
  H3: 'H3 · 1-2 anos', H4: 'H4 · 3-5 anos', H5: 'H5 · vida',
}

function tinted(color: string): React.CSSProperties {
  return { background: `${color}33`, borderColor: `${color}88`, color: 'var(--fg)' }
}

interface Props {
  project: Project
  areas: Area[]
  allProjects: Project[]
  onSave: (input: ProjectSaveInput) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onComplete?: (id: string) => Promise<void>
  onClose: () => void
  isCreate?: boolean
}

export function ProjectPanel({ project, areas, allProjects, onSave, onArchive, onComplete, onClose, isCreate }: Props) {
  const [name, setName] = useState(project.name)
  const [outcome, setOutcome] = useState(project.outcome ?? '')
  const [status, setStatus] = useState<ProjectStatusType>(project.status)
  const [kind, setKind] = useState<ProjectKind>(project.kind)
  const [horizon, setHorizon] = useState<HorizonLvl>(project.horizon)
  const [areaId, setAreaId] = useState<string | undefined>(project.areaId)
  const [parentId, setParentId] = useState<string | undefined>(project.parentId)
  const [targetDate, setTargetDate] = useState(project.targetDate ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setName(project.name); setOutcome(project.outcome ?? ''); setStatus(project.status)
    setKind(project.kind); setHorizon(project.horizon); setAreaId(project.areaId)
    setParentId(project.parentId); setTargetDate(project.targetDate ?? '')
  }, [project])

  const selectedArea = areas.find(a => a.id === areaId)
  const possibleParents = allProjects.filter(p => !p.parentId && p.id !== project.id)
  const selectedParent = possibleParents.find(p => p.id === parentId)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const input: ProjectSaveInput = {
        name: name.trim(),
        kind,
        status,
        horizon,
        color: project.color,
      }
      if (!isCreate && project.id) input.id = project.id
      if (outcome.trim()) input.outcome = outcome.trim()
      if (areaId) input.areaId = areaId
      if (parentId) input.parentId = parentId
      if (targetDate) input.targetDate = targetDate
      await onSave(input)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!project.id) return
    setSaving(true)
    try { await onArchive(project.id); onClose() }
    finally { setSaving(false) }
  }

  const handleComplete = async () => {
    if (!project.id || !onComplete) return
    setSaving(true)
    try { await onComplete(project.id); onClose() }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="task-panel-overlay" onClick={onClose}>
        <div className="task-panel" onClick={e => e.stopPropagation()}>
          <div className="task-panel-header">
            <span className="task-panel-label">{isCreate ? 'Novo projeto' : 'Projeto'}</span>
            <button className="task-panel-close" onClick={onClose} aria-label="Fechar">×</button>
          </div>

          <div className="task-panel-body">
            <textarea
              className="task-panel-title-input"
              value={name}
              onChange={e => setName(e.target.value)}
              rows={2}
              placeholder="Nome do projeto"
              autoFocus={isCreate}
            />

            <div className="chip-row">
              <Chip
                label={STATUS_LABELS[status]}
                style={tinted(STATUS_COLORS[status])}
                popover={(close) => (
                  <div className="popover-list">
                    {(Object.keys(STATUS_LABELS) as ProjectStatusType[]).filter(s => s !== 'archived').map(s => (
                      <button key={s} className="popover-item" onClick={() => { setStatus(s); close() }}
                        style={{ borderLeft: `3px solid ${STATUS_COLORS[s]}` }}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={KIND_LABELS[kind]}
                style={tinted(KIND_COLORS[kind])}
                popover={(close) => (
                  <div className="popover-list">
                    {(Object.keys(KIND_LABELS) as ProjectKind[]).map(k => (
                      <button key={k} className="popover-item" onClick={() => { setKind(k); close() }}>
                        {KIND_LABELS[k]}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={HORIZON_LABELS[horizon]}
                popover={(close) => (
                  <div className="popover-list">
                    {(Object.keys(HORIZON_LABELS) as HorizonLvl[]).map(h => (
                      <button key={h} className="popover-item" onClick={() => { setHorizon(h); close() }}>
                        {HORIZON_LABELS[h]}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="chip-row">
              <Chip
                label={selectedArea?.name ?? '+ área'}
                {...(selectedArea ? { style: tinted(QUADRANT_COLORS[selectedArea.quadrant]) } : {})}
                popover={(close) => (
                  <div className="popover-list">
                    <button className="popover-item" onClick={() => { setAreaId(undefined); close() }}>sem área</button>
                    {areas.map(a => (
                      <button key={a.id} className="popover-item"
                        onClick={() => { setAreaId(a.id); close() }}
                        style={{ borderLeft: `3px solid ${QUADRANT_COLORS[a.quadrant]}` }}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              />
              <Chip
                label={targetDate || '+ target'}
                icon={<IconCalendar />}
                popover={(close) => (
                  <div className="popover-input">
                    <input type="date" value={targetDate}
                      onChange={e => setTargetDate(e.target.value)} autoFocus />
                    {targetDate && <button className="popover-item-small"
                      onMouseDown={() => { setTargetDate(''); close() }}>limpar</button>}
                  </div>
                )}
              />
              <Chip
                label={selectedParent ? `pai: ${selectedParent.name}` : '+ parent'}
                popover={(close) => (
                  <div className="popover-list">
                    <button className="popover-item" onClick={() => { setParentId(undefined); close() }}>sem pai</button>
                    {possibleParents.map(p => (
                      <button key={p.id} className="popover-item" onClick={() => { setParentId(p.id); close() }}>
                        {p.name}
                      </button>
                    ))}
                    {possibleParents.length === 0 && (
                      <span className="popover-item" style={{ color: 'var(--fg-muted)', fontStyle: 'italic' }}>
                        nenhum pai disponível
                      </span>
                    )}
                  </div>
                )}
              />
            </div>

            <span className="task-panel-notes-label">Outcome</span>
            <textarea
              className="task-panel-notes"
              value={outcome}
              onChange={e => setOutcome(e.target.value)}
              placeholder="o resultado esperado é..."
            />
          </div>

          <div className="task-panel-actions">
            {!isCreate && project.id && (
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(true)} disabled={saving}>
                Arquivar
              </button>
            )}
            {!isCreate && project.id && kind === 'outcome' && status !== 'done' && onComplete && (
              <button className="btn btn-ghost" onClick={() => { void handleComplete() }} disabled={saving}>
                Marcar concluído
              </button>
            )}
            <button className="btn btn-accent" onClick={() => { void handleSave() }} disabled={saving || !name.trim()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Arquivar projeto"
        message="Este projeto será removido da lista (tasks dele continuam visíveis)."
        detail={project.name}
        confirmLabel="Arquivar"
        onConfirm={() => { void handleArchive() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/projects/ProjectPanel.tsx
git commit -m "feat: ProjectPanel chips inline (status/kind/horizon/área/target/parent + outcome)"
```

---

## Task 9: ProjectRow + ProjectsView

**Files:**
- Create: `src/components/projects/ProjectRow.tsx`
- Create: `src/components/projects/ProjectsView.tsx`

- [ ] **Step 1: Criar ProjectRow**

Criar `src/components/projects/ProjectRow.tsx`:

```typescript
import type { Project, Area } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'

interface Props {
  project: Project
  areas: Area[]
  isChild?: boolean
  onSelect: (project: Project) => void
}

export function ProjectRow({ project, areas, isChild, onSelect }: Props) {
  const area = areas.find(a => a.id === project.areaId)
  const accent = project.resolvedQuadrant
    ? QUADRANT_COLORS[project.resolvedQuadrant]
    : (area ? QUADRANT_COLORS[area.quadrant] : '#9ca3af')

  const total = project.taskCount
  const open = project.taskOpenCount
  const done = total - open
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const isOutcome = project.kind === 'outcome'

  return (
    <div
      className={`project-row${isChild ? ' is-child' : ''}`}
      onClick={() => onSelect(project)}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="project-row-main">
        <div className="project-row-header">
          <span className="project-row-name">{project.title || project.name}</span>
          {!isOutcome && <span className="project-row-badge">evergreen</span>}
        </div>
        {project.outcome && (
          <div className="project-row-outcome">{project.outcome}</div>
        )}
        <div className="project-row-meta">
          {area && <span>{area.name}</span>}
          <span>{project.horizon}</span>
          {isOutcome && <span>{done}/{total} tasks</span>}
          {!isOutcome && <span>{open} abertas</span>}
          {project.targetDate && <span>due {project.targetDate}</span>}
          {project.childCount > 0 && <span>{project.childCount} sub</span>}
        </div>
      </div>
      {isOutcome && total > 0 && (
        <div className="project-row-progress">
          <div className="project-progress-bar"><div className="project-progress-fill" style={{ width: `${pct}%` }} /></div>
          <span className="project-progress-pct">{pct}%</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar ProjectsView**

Criar `src/components/projects/ProjectsView.tsx`:

```typescript
import type { Project, Area, HorizonLvl } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'
import { ProjectRow } from './ProjectRow.tsx'

type Mode = 'horizon' | 'area' | 'flat'

interface Props {
  projects: Project[]
  areas: Area[]
  mode: Mode
  onSelect: (project: Project) => void
}

const HORIZON_ORDER: HorizonLvl[] = ['H0', 'H1', 'H2', 'H3', 'H4', 'H5']
const HORIZON_LABELS: Record<HorizonLvl, string> = {
  H0: 'H0 · agora', H1: 'H1 · esta semana', H2: 'H2 · trimestre',
  H3: 'H3 · 1-2 anos', H4: 'H4 · 3-5 anos', H5: 'H5 · vida',
}

interface Group {
  id: string
  label: string
  accent?: string
  projects: Project[]
}

function groupProjects(projects: Project[], areas: Area[], mode: Mode): Group[] {
  // Separar pais e filhos
  const parents = projects.filter(p => !p.parentId)
  const childrenByParent = new Map<string, Project[]>()
  for (const p of projects) {
    if (p.parentId) {
      const arr = childrenByParent.get(p.parentId) ?? []
      arr.push(p)
      childrenByParent.set(p.parentId, arr)
    }
  }

  if (mode === 'horizon') {
    return HORIZON_ORDER
      .map(h => ({
        id: h,
        label: HORIZON_LABELS[h],
        projects: parents.filter(p => p.horizon === h),
      }))
      .filter(g => g.projects.length > 0)
  }

  if (mode === 'area') {
    const groups: Group[] = []
    for (const a of areas) {
      const ps = parents.filter(p => p.areaId === a.id)
      if (ps.length > 0) {
        groups.push({ id: a.id, label: a.name, accent: QUADRANT_COLORS[a.quadrant], projects: ps })
      }
    }
    const noArea = parents.filter(p => !p.areaId)
    if (noArea.length > 0) groups.push({ id: 'none', label: 'sem área', projects: noArea })
    return groups
  }

  // flat
  return [{ id: 'all', label: '', projects: parents }]
}

export function ProjectsView({ projects, areas, mode, onSelect }: Props) {
  const groups = groupProjects(projects, areas, mode)
  const childrenByParent = new Map<string, Project[]>()
  for (const p of projects) {
    if (p.parentId) {
      const arr = childrenByParent.get(p.parentId) ?? []
      arr.push(p)
      childrenByParent.set(p.parentId, arr)
    }
  }

  if (groups.length === 0) {
    return <div className="empty-state">Nenhum projeto neste filtro</div>
  }

  return (
    <div className="content">
      {groups.map(g => (
        <div key={g.id} className="task-group">
          {g.label && (
            <div className="task-group-title" style={g.accent ? { color: g.accent } : undefined}>
              {g.label}
              <span className="task-group-count">{g.projects.length}</span>
            </div>
          )}
          {g.projects.map(p => (
            <div key={p.id}>
              <ProjectRow project={p} areas={areas} onSelect={onSelect} />
              {(childrenByParent.get(p.id) ?? []).map(child => (
                <ProjectRow key={child.id} project={child} areas={areas} isChild onSelect={onSelect} />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/ProjectRow.tsx src/components/projects/ProjectsView.tsx
git commit -m "feat: ProjectRow + ProjectsView (agrupamento horizon/área/flat + sub-projetos indentados)"
```

---

## Task 10: ProjectsPage + rota

**Files:**
- Create: `src/pages/ProjectsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Criar ProjectsPage**

Criar `src/pages/ProjectsPage.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Topbar } from '../components/layout/Topbar.tsx'
import { ThemeToggle } from '../components/common/ThemeToggle.tsx'
import { ProjectsView } from '../components/projects/ProjectsView.tsx'
import { ProjectPanel } from '../components/projects/ProjectPanel.tsx'
import { useProjects } from '../hooks/useProjects.ts'
import { useAreas } from '../hooks/useAreas.ts'
import type { Project } from '../types/domain.ts'

type Mode = 'horizon' | 'area' | 'flat'
type StatusFilter = 'active' | 'on_hold' | 'someday' | 'done'

const STORAGE_KEY = 'jp_projects_groupby'

const EMPTY_PROJECT: Project = {
  id: '', userId: '', name: '', color: '#7dd3fc',
  archived: false, createdAt: '', updatedAt: '',
  kind: 'outcome', status: 'active', horizon: 'H1',
  position: 0, taskCount: 0, taskOpenCount: 0, childCount: 0,
}

function loadMode(): Mode {
  if (typeof window === 'undefined') return 'horizon'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'horizon' || saved === 'area' || saved === 'flat') return saved
  return 'horizon'
}

export function ProjectsPage() {
  const [mode, setMode] = useState<Mode>(loadMode)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [selected, setSelected] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const { projects, loading, save, archive, complete, refetch } = useProjects({ status: statusFilter })
  const { areas, loading: areasLoading } = useAreas()

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, mode) } catch { /* noop */ }
  }, [mode])

  if (loading || areasLoading) {
    return (
      <div>
        <Topbar title="Projetos" actions={<ThemeToggle />} />
        <div className="empty-state" style={{ paddingTop: '30vh' }}>Carregando…</div>
      </div>
    )
  }

  return (
    <div>
      <Topbar title="Projetos" actions={<ThemeToggle />} />

      <div className="projects-toolbar">
        <div className="projects-toolbar-group">
          {(['horizon','area','flat'] as Mode[]).map(m => (
            <button key={m}
              className={`kanban-mode-btn${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}>
              {m === 'horizon' ? 'Horizonte' : m === 'area' ? 'Área' : 'Flat'}
            </button>
          ))}
        </div>
        <div className="projects-toolbar-group">
          {(['active','on_hold','someday','done'] as StatusFilter[]).map(s => (
            <button key={s}
              className={`kanban-mode-btn${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}>
              {s === 'active' ? 'ativos' : s === 'on_hold' ? 'pausados' : s === 'someday' ? 'algum dia' : 'concluídos'}
            </button>
          ))}
        </div>
        <button className="btn btn-accent projects-new-btn" onClick={() => setCreating(true)}>
          + novo
        </button>
      </div>

      <ProjectsView
        projects={projects}
        areas={areas}
        mode={mode}
        onSelect={setSelected}
      />

      {selected && (
        <ProjectPanel
          project={selected}
          areas={areas}
          allProjects={projects}
          onSave={async input => { await save(input) }}
          onArchive={async id => { await archive(id) }}
          onComplete={async id => { await complete(id) }}
          onClose={() => setSelected(null)}
        />
      )}

      {creating && (
        <ProjectPanel
          project={EMPTY_PROJECT}
          areas={areas}
          allProjects={projects}
          isCreate
          onSave={async input => { await save(input); await refetch() }}
          onArchive={async () => { /* unreachable */ }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar rota em App.tsx**

Em `src/App.tsx`, adicionar import:

```typescript
import { ProjectsPage } from './pages/ProjectsPage.tsx'
```

E adicionar rota antes do `<Route path="*" ...>`:

```typescript
<Route
  path="/projects"
  element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>}
/>
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectsPage.tsx src/App.tsx
git commit -m "feat: ProjectsPage standalone (/projects) + toolbar mode/status + rota"
```

---

## Task 11: ProjectsCard + DashboardPage integração

**Files:**
- Create: `src/components/projects/ProjectsCard.tsx`
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Criar ProjectsCard**

Criar `src/components/projects/ProjectsCard.tsx`:

```typescript
import { Link } from 'react-router-dom'
import type { Project, Area } from '../../types/domain.ts'
import { QUADRANT_COLORS } from '../../types/domain.ts'

interface Props {
  projects: Project[]
  areas: Area[]
}

export function ProjectsCard({ projects, areas }: Props) {
  const top = projects
    .filter(p => p.status === 'active' && !p.parentId)
    .sort((a, b) => a.position - b.position)
    .slice(0, 5)

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <span className="dashboard-card-title">Projetos ativos</span>
        <Link to="/projects" className="dashboard-card-link">ver tudo →</Link>
      </div>
      {top.length === 0 ? (
        <div className="dashboard-card-empty">Nenhum projeto ativo</div>
      ) : (
        <div className="dashboard-card-list">
          {top.map(p => {
            const area = areas.find(a => a.id === p.areaId)
            const accent = p.resolvedQuadrant
              ? QUADRANT_COLORS[p.resolvedQuadrant]
              : (area ? QUADRANT_COLORS[area.quadrant] : '#9ca3af')
            const total = p.taskCount
            const done = total - p.taskOpenCount
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Link key={p.id} to="/projects" className="dashboard-card-row" style={{ borderLeft: `3px solid ${accent}` }}>
                <div className="dashboard-card-row-main">
                  <div className="dashboard-card-row-name">{p.title || p.name}</div>
                  <div className="dashboard-card-row-meta">
                    {area && <span>{area.name}</span>}
                    <span>{p.horizon}</span>
                    {p.kind === 'outcome' && total > 0 && <span>{pct}%</span>}
                    {p.kind === 'evergreen' && <span>evergreen</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar ProjectsCard no DashboardPage**

Ler `src/pages/DashboardPage.tsx` primeiro pra ver estrutura:

```bash
# (tool: Read DashboardPage.tsx)
```

Depois adicionar:
- import: `import { ProjectsCard } from '../components/projects/ProjectsCard.tsx'`
- import: `import { useProjects } from '../hooks/useProjects.ts'`
- import (se não tiver): `import { useAreas } from '../hooks/useAreas.ts'`
- chamada do hook no componente: `const { projects } = useProjects()` e `const { areas } = useAreas()`
- renderização do componente em local apropriado: `<ProjectsCard projects={projects} areas={areas} />`

A localização exata depende da estrutura atual. Adicionar como último card (ou primeiro, conforme decisão do dev).

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/ProjectsCard.tsx src/pages/DashboardPage.tsx
git commit -m "feat: ProjectsCard no Dashboard (top 5 ativos com progresso)"
```

---

## Task 12: Tab Projetos no TasksPage

**Files:**
- Modify: `src/pages/TasksPage.tsx`

- [ ] **Step 1: Adicionar imports e tab**

Em `src/pages/TasksPage.tsx`:

1. Adicionar import:
```typescript
import { ProjectsView } from '../components/projects/ProjectsView.tsx'
import { ProjectPanel } from '../components/projects/ProjectPanel.tsx'
import type { Project } from '../types/domain.ts'
```

2. Atualizar TABS:
```typescript
const TABS = ['Today', 'Inbox', 'Kanban', 'Lista', 'Projetos', 'Gantt'] as const
```

3. Adicionar state e handlers:
```typescript
const [selectedProject, setSelectedProject] = useState<Project | null>(null)
const { save: saveProject, archive: archiveProject, complete: completeProject } = useProjects()
```

(Note: `useProjects` já está importado e usado pra `projects`. Renomear destructuring no hook existente:)

```typescript
const { projects, loading: projectsLoading, save: saveProject, archive: archiveProject, complete: completeProject, refetch: refetchProjects } = useProjects()
```

4. Adicionar bloco de tab antes de `{tab === 'Gantt' && ...}`:

```tsx
{tab === 'Projetos' && (
  <ProjectsView
    projects={projects}
    areas={areas}
    mode="horizon"
    onSelect={setSelectedProject}
  />
)}
```

5. Adicionar ProjectPanel ao lado dos outros panels:

```tsx
{selectedProject && (
  <ProjectPanel
    project={selectedProject}
    areas={areas}
    allProjects={projects}
    onSave={async input => { await saveProject(input) }}
    onArchive={async id => { await archiveProject(id); await refetchProjects() }}
    onComplete={async id => { await completeProject(id) }}
    onClose={() => setSelectedProject(null)}
  />
)}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: PASS. Pode haver erros se TasksPage tiver references a `archive`/`save` ambíguos depois do rename. Resolver ajustando para os nomes específicos (saveProject vs save, etc.).

- [ ] **Step 3: Commit**

```bash
git add src/pages/TasksPage.tsx
git commit -m "feat: tab Projetos em TasksPage com ProjectsView + ProjectPanel"
```

---

## Task 13: Integração TaskPanel — "+ novo projeto" + dot no TaskRow

**Files:**
- Modify: `src/components/tasks/TaskPanel.tsx`
- Modify: `src/components/tasks/TaskRow.tsx`

- [ ] **Step 1: Adicionar callback onCreateProject ao TaskPanel**

Em `src/components/tasks/TaskPanel.tsx`, adicionar à interface Props:

```typescript
onCreateProject?: () => void
```

E destructure no componente:

```typescript
export function TaskPanel({ task, projects, areas, onSave, onArchive, onClassify, onCreateProject, onClose, isCreate }: Props) {
```

E adicionar import do IconPlus se não tiver:

```typescript
import { IconCalendar, IconClock, IconPause, IconRepeat, IconSparkle, IconPlus, EnergyDots } from '../common/Icon.tsx'
```

Localizar o popover do chip "Projeto" (procurar `<Chip label={selectedProject?.name`) e adicionar item após o `.map()`:

```tsx
<Chip
  label={selectedProject?.name ?? 'Sem projeto'}
  popover={(close) => (
    <div className="popover-list">
      {projects.map(p => (
        <button key={p.id} className="popover-item" onClick={() => { setProjectId(p.id); close() }}>
          {p.name}
        </button>
      ))}
      {onCreateProject && (
        <>
          <div className="popover-divider" />
          <button
            className="popover-item popover-item-add"
            onClick={() => { close(); onCreateProject() }}
          >
            <IconPlus size={12} /> novo projeto
          </button>
        </>
      )}
    </div>
  )}
/>
```

- [ ] **Step 2: Wire onCreateProject em TasksPage**

Em `src/pages/TasksPage.tsx`, no bloco do TaskPanel (que já existe), adicionar:

```tsx
onCreateProject={() => {
  // fecha panel atual de task; abre create de projeto.
  // Após criar projeto, user reabre task pra setar projeto novo (UX simples).
  setSelectedProject({
    id: '', userId: '', name: '', color: '#7dd3fc',
    archived: false, createdAt: '', updatedAt: '',
    kind: 'outcome', status: 'active', horizon: 'H1',
    position: 0, taskCount: 0, taskOpenCount: 0, childCount: 0,
  })
}}
```

(Note: This opens the project panel as if editing an empty project — but we want isCreate. Better approach: usar `creatingProject` state separate.)

**Implementação simplificada e correta:** Em vez de abrir ProjectPanel inline, usar `window.confirm` ou navegar pra /projects? Não — má UX. Usar state separado:

```typescript
const [creatingProject, setCreatingProject] = useState(false)
```

E no TaskPanel callback:
```typescript
onCreateProject={() => setCreatingProject(true)}
```

E renderizar:
```tsx
{creatingProject && (
  <ProjectPanel
    project={EMPTY_PROJECT_TEMPLATE}
    areas={areas}
    allProjects={projects}
    isCreate
    onSave={async input => { await saveProject(input); await refetchProjects(); setCreatingProject(false) }}
    onArchive={async () => { /* unreachable */ }}
    onClose={() => setCreatingProject(false)}
  />
)}
```

Onde `EMPTY_PROJECT_TEMPLATE` é constante no topo do arquivo. Use a mesma constante de Task 10 ou crie inline.

- [ ] **Step 3: Adicionar dot no TaskRow**

Em `src/components/tasks/TaskRow.tsx`, localizar:

```tsx
{project && <span className="task-project">{project.name}</span>}
```

Substituir por:

```tsx
{project && (
  <span className="task-project">
    <span className="task-project-dot" style={{ background: project.color }} />
    {project.name}
  </span>
)}
```

- [ ] **Step 4: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskPanel.tsx src/components/tasks/TaskRow.tsx src/pages/TasksPage.tsx
git commit -m "feat: TaskPanel popover Projeto com '+ novo projeto'; TaskRow com dot de cor"
```

---

## Task 14: CSS — projects rows, panel, dashboard card, dots, divider

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Adicionar regras CSS no fim do arquivo**

Em `src/styles/globals.css`, adicionar no fim (após o último bloco existente):

```css
/* =============================================================
   PROJECTS MODULE — rows, panel, dashboard card, toolbar
   ============================================================= */

/* ---------- Project Row ---------- */
.project-row {
  display: flex; gap: 12px; padding: 14px 12px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer; transition: background 0.15s;
}
.project-row:hover { background: var(--bg-elevated); }
.project-row.is-child { padding-left: 32px; background: var(--bg-elevated); }
.project-row.is-child::before {
  content: '↳'; color: var(--fg-dim); margin-right: 6px;
  font-family: 'Space Mono', monospace; font-size: 10px;
}
.project-row-main { flex: 1; min-width: 0; }
.project-row-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
}
.project-row-name {
  font-size: 13px; font-weight: 500; color: var(--fg);
}
.project-row-badge {
  font-family: 'Space Mono', monospace; font-size: 9px;
  color: var(--fg-muted); letter-spacing: 1px;
  background: var(--bg-elevated); padding: 2px 6px; border-radius: 8px;
  border: 1px solid var(--border);
}
.project-row-outcome {
  font-size: 11px; color: var(--fg-muted); line-height: 1.4;
  margin-bottom: 6px;
  display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-row-meta {
  display: flex; gap: 10px; flex-wrap: wrap;
  font-family: 'Space Mono', monospace; font-size: 9px;
  color: var(--fg-muted); letter-spacing: 0.5px;
}
.project-row-progress {
  display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
  min-width: 80px; padding-top: 4px;
}
.project-progress-bar {
  width: 80px; height: 3px; background: var(--bg-elevated); border-radius: 2px; overflow: hidden;
}
.project-progress-fill {
  height: 100%; background: var(--accent); transition: width 0.3s;
}
.project-progress-pct {
  font-family: 'Space Mono', monospace; font-size: 9px;
  color: var(--fg-muted); letter-spacing: 0.5px;
}

/* ---------- Projects Toolbar ---------- */
.projects-toolbar {
  display: flex; gap: 12px; padding: 10px 18px;
  border-bottom: 1px solid var(--border);
  align-items: center; flex-wrap: wrap;
}
.projects-toolbar-group {
  display: flex; gap: 4px;
}
.projects-new-btn {
  margin-left: auto; padding: 6px 12px; font-size: 11px;
}

/* ---------- Popover divider + add item ---------- */
.popover-divider {
  height: 1px; background: var(--border-light); margin: 6px 0;
}
.popover-item-add {
  color: var(--accent-ink); background: var(--accent-soft);
  display: inline-flex; align-items: center; gap: 6px;
}
.popover-item-add:hover {
  background: var(--accent); color: var(--accent-ink);
}

/* ---------- Task project dot ---------- */
.task-project-dot {
  display: inline-block; width: 6px; height: 6px;
  border-radius: 50%; margin-right: 6px;
  vertical-align: middle;
}

/* ---------- Dashboard project card ---------- */
.dashboard-card {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 6px; padding: 14px; margin-bottom: 16px;
}
.dashboard-card-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
}
.dashboard-card-title {
  font-family: 'Space Mono', monospace; font-size: 10px;
  letter-spacing: 1.5px; text-transform: uppercase;
  color: var(--fg-muted); font-weight: 700;
}
.dashboard-card-link {
  font-family: 'Space Mono', monospace; font-size: 9px;
  letter-spacing: 1px; color: var(--accent-ink);
  text-decoration: none; opacity: 0.7;
}
.dashboard-card-link:hover { opacity: 1; }
.dashboard-card-empty {
  font-size: 12px; color: var(--fg-muted); padding: 20px 0; text-align: center;
}
.dashboard-card-list { display: flex; flex-direction: column; gap: 4px; }
.dashboard-card-row {
  display: flex; gap: 10px; padding: 10px 12px;
  text-decoration: none; color: var(--fg);
  background: var(--bg); border-radius: 4px;
  transition: background 0.15s;
}
.dashboard-card-row:hover { background: var(--border-light); }
.dashboard-card-row-main { flex: 1; min-width: 0; }
.dashboard-card-row-name {
  font-size: 12px; font-weight: 500; margin-bottom: 4px;
}
.dashboard-card-row-meta {
  display: flex; gap: 8px; flex-wrap: wrap;
  font-family: 'Space Mono', monospace; font-size: 9px;
  color: var(--fg-muted); letter-spacing: 0.5px;
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: CSS Projects (rows, panel toolbar, popover divider, dashboard card, project dot)"
```

---

## Task 15: Verificação final + smoke

**Files:** todo o repo

- [ ] **Step 1: Rodar todos os testes**

```bash
npm run test -- --run
```

Expected: PASS — testes anteriores (67) + novos do project schema (~22). Pelo menos ~89 testes verdes.

- [ ] **Step 2: Build completo**

```bash
npm run build
```

Expected: `tsc -b && vite build` ambos zero erros.

- [ ] **Step 3: Smoke test local (manual)**

Subir servidores:
```bash
npm run dev:api  # background
npm run dev      # background
```

Em http://localhost:3000:
1. Login
2. Navegar pra `/projects` direto via URL
3. Toolbar: trocar entre Horizonte / Área / Flat — cada um agrupa diferente
4. Filtrar por status (active/on_hold/someday/done)
5. Click "+ novo" → ProjectPanel abre. Preenche nome + outcome + horizon + área. Salva.
6. Click no projeto criado → edita kind pra evergreen, salva. Abre de novo, confirma que botão "Marcar concluído" sumiu.
7. Cria projeto B com parent = projeto A. ProjectsView mostra B indentado sob A.
8. Tenta criar projeto C com parent = B → backend deve rejeitar (alert).
9. No TasksPage, abre task. Chip Projeto popover → "+ novo projeto" abre ProjectPanel. Cria. Volta pra task, projeto novo aparece na lista.
10. No TaskRow, dot de cor do projeto aparece à esquerda do nome.
11. Em /briefing ou /dashboard (se DashboardPage estiver no nav), card Projetos ativos mostra top 5.
12. Tab Projetos em /tasks mostra agrupado por horizonte.

- [ ] **Step 4: Status check git**

```bash
git status
git log --oneline master..HEAD
```

Verifica que todos os commits estão lá e working tree está limpo.

- [ ] **Step 5: Push pra origin (opcional, se aprovado pelo user)**

```bash
git push origin master
```

Vercel deploya automático.

---

## Self-Review

**Spec coverage:**
- ✅ Section 1 (Schema/API): Tasks 1-6 cobrem migration, schema, save/archive/complete/list
- ✅ Section 2 (Hooks): Task 7 estende useProjects
- ✅ Section 3 (UI components): Tasks 8-10 (ProjectPanel, ProjectRow, ProjectsView, ProjectsPage)
- ✅ Section 4 (Integração com Tasks): Tasks 12 (tab Projetos), 13 (+ novo projeto + dot)
- ✅ Section 5 (Testes/Migração/Rollout): Task 1 (migration), Task 2 (testes), Task 15 (verificação)
- ✅ Card no Dashboard: Task 11

**Placeholder scan:** Sem TBDs operacionais. Step 2 do Task 11 menciona "ler o arquivo primeiro" como instrução pro engenheiro — isso é OK, não é placeholder de plano.

**Type consistency:**
- `Project` type definido em Task 3 com agregados (taskCount, taskOpenCount, childCount como required) e usado em Tasks 4-13 consistentemente
- `ProjectSaveInput` usa `z.input` (Task 2) — callers podem omitir defaults (status, kind, horizon, color, position)
- Cores `STATUS_COLORS` e `KIND_COLORS` definidos em ProjectPanel (Task 8) — não reusados em outros arquivos (OK, são locais ao panel)
- View `v_projects_with_counts` usada em projects-list (Task 4); endpoints save/complete usam tabela `projects` direta + map manual (Tasks 5/6 — OK pois não precisam dos agregados)

**Risco residual:**
- Task 11 (DashboardPage): instrui o engenheiro a "ler estrutura primeiro" pois layout específico depende do que existe. Se DashboardPage for trivial, basta adicionar o card no fim do JSX.
- Migration 0012 precisa ser aplicada manualmente pelo user no Supabase antes de rodar endpoints. Plan documenta isso no Task 1 step 2.
- Hierarquia 1-nível enforce only no handler — bypass via SQL direto possível mas aceitável (single user).

**Total estimado:** ~3-4h de implementação focada conforme spec.
