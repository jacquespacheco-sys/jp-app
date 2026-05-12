# Projects AQAL CRUD — design da fase 3

**Status:** approved (brainstorming) → implementing
**Branch:** `master` (sai feature branch durante implementação)
**Predecessor:** Tasks AQAL fase 2 (commits até `9078d58`)

## Objetivo

Habilitar gestão completa de projetos AQAL/GTD:
- Página `/projects` nova com listagem, filtros, criação e edição
- Distinção semântica entre **outcome** (com fim definido, progress bar) e **evergreen** (contínuo, sem barra)
- Hierarquia leve (1 nível: projetos podem ter sub-projetos diretos)
- Integração com Tasks: criar projeto inline a partir do TaskPanel; cor do projeto na TaskRow
- Card no Dashboard com top 5 projetos ativos
- Tab "Projetos" no TasksPage com mini view

## Decisões consolidadas (brainstorming)

| Decisão | Escolha |
|---|---|
| Localização | Combo: card no Dashboard + tab "Projetos" em /tasks + página /projects standalone |
| Outcome vs Evergreen | Outcome com progress bar + target_date; Evergreen com label, sem barra, sempre active |
| Hierarquia | 1 nível (parent + filhos diretos). Sub-sub-projetos rejeitados no handler |
| Layout default | Agrupado por horizonte (H0..H5) com toggle pra Área e Flat |

## Não-objetivos desta fase

- Drag & drop para reordenar projetos
- Bulk operations (arquivar múltiplos)
- Auto-completar projeto quando todas tasks done
- Notificações de target_date
- Templates de projeto
- AI Coach insights sobre projetos
- Filtros avançados (full-text search, tags)

---

## Seção 1 — Schema & API

Schema já existe (migration 0010). Documenta como API consome.

### `api/_schemas/project.ts` (NOVO)

```typescript
import { z } from 'zod'

export const ProjectSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  title: z.string().optional(),
  outcome: z.string().optional(),
  color: z.string().regex(/^#/).default('#7dd3fc'),
  kind: z.enum(['outcome','evergreen']).default('outcome'),
  status: z.enum(['active','on_hold','someday','done','archived']).default('active'),
  horizon: z.enum(['H0','H1','H2','H3','H4','H5']).default('H1'),
  areaId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  quadrantOverride: z.enum(['I','IT','WE','ITS']).optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  position: z.number().int().default(0),
})

export type ProjectSaveInput = z.input<typeof ProjectSaveSchema>

export const ProjectArchiveSchema = z.object({ id: z.string().uuid() })
export const ProjectCompleteSchema = z.object({ id: z.string().uuid() })
```

### Endpoints

| Endpoint | Método | Função |
|---|---|---|
| `/api/projects-list` | GET | **Refactor:** retorna campos AQAL completos + agregados (taskCount, taskOpenCount, childCount). Aceita `?status=` filter. |
| `/api/projects-save` | POST/PATCH | **Novo:** cria/edita. Valida hierarquia 1-nível (rejeita parent_id se aponta pra projeto que já tem parent_id). |
| `/api/projects-archive` | POST | **Novo:** marca `archived_at = now()`, `status='archived'`. Não delete. |
| `/api/projects-complete` | POST | **Novo:** marca `completed_at = now()`, `status='done'`. Apenas para `kind='outcome'` (rejeita evergreen). |

### Validação de hierarquia (handler)

`projects-save.ts` quando `parentId` for passado:
1. Buscar projeto pai
2. Se `pai.parent_id != null`, retornar 400 com erro "hierarquia limitada a 1 nível"

### Tipos atualizados em `src/types/domain.ts`

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
  // AQAL
  title?: string
  outcome?: string
  kind: ProjectKind
  status: ProjectStatusType
  horizon: HorizonLvl
  areaId?: string
  parentId?: string
  quadrantOverride?: Quadrant
  resolvedQuadrant?: Quadrant  // calculado: override > area
  targetDate?: string
  position: number
  completedAt?: string
  archivedAt?: string
  // agregados (preenchidos pelo endpoint, não vão no save)
  taskCount: number
  taskOpenCount: number
  childCount: number
}
```

E em `src/types/api.ts`:
```typescript
export interface ProjectSaveResponse { project: Project }
```

---

## Seção 2 — Hooks & estado

### `src/hooks/useProjects.ts` (extend)

```typescript
export function useProjects(opts?: { includeArchived?: boolean }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const q = opts?.includeArchived ? '?status=archived' : ''
    const res = await api.get<ProjectsListResponse>(`/api/projects-list${q}`)
    setProjects(res.projects)
    setLoading(false)
  }, [opts?.includeArchived])

  const save = useCallback(async (input: ProjectSaveInput): Promise<Project> => {
    const method = input.id ? 'patch' : 'post'
    const res = await api[method]<ProjectSaveResponse>('/api/projects-save', input)
    setProjects(prev => input.id
      ? prev.map(p => p.id === res.project.id ? res.project : p)
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
    setProjects(prev => prev.map(p => p.id === res.project.id ? res.project : p))
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  return { projects, loading, save, archive, complete, refetch: fetch }
}
```

Mantém compat: callers existentes (`useProjects()` sem args) continuam funcionando.

### Estado local de filtros (não persistente entre sessões)

- `currentHorizon: HorizonLvl | 'all'` — default 'all'
- `currentStatus: 'active' | 'all' | 'someday' | 'done'` — default 'active'
- `groupBy: 'horizon' | 'area' | 'flat'` — default 'horizon', persistido em `localStorage` key `jp_projects_groupby`

---

## Seção 3 — UI components

### `src/pages/ProjectsPage.tsx` (NOVO)

Layout:
```
┌─ Topbar: "Projetos" + sync actions
├─ ToggleBar: [horizonte | área | flat]   [active | on_hold | someday | done]
├─ + novo projeto (botão accent à direita)
├─ <ProjectsView mode={groupBy} statusFilter={status} ... />
└─ <ProjectPanel ... /> overlay quando project selecionado
```

### `src/components/projects/ProjectRow.tsx` (NOVO)

```
[● area-bar 3px] Nome do projeto         [outcome | evergreen badge]
                outcome description (1 linha truncada)
                5/12 tasks · H1 · due 2026-05-20    [▭▭▭▭□] 42%
```

- Click → `onSelect(project)` (abre ProjectPanel)
- Outcome: progress bar + counter `taskCount - taskOpenCount / taskCount`
- Evergreen: label "evergreen", sem barra, mostra `taskOpenCount` abertas
- Sub-projetos (parentId != null): renderizados indentados sob pai com linha conectora visual

### `src/components/projects/ProjectPanel.tsx` (NOVO)

Mesmo padrão do TaskPanel — chips inline:

```
[× fechar]                                    Projeto
─────────────────────────────────────────────────────
[título — textarea grande]
─────────────────────────────────────────────────────
[● status: active]  [kind: outcome]  [horizon: H1]
[● Área: JP App]    [target: 2026-05-20]  [+ parent]
─────────────────────────────────────────────────────
[outcome — textarea menor: "o resultado esperado é..."]
─────────────────────────────────────────────────────
[arquivar] [marcar concluído (só outcome)]   [salvar]
```

Cores:
- Status — chip tinted (active=accent, on_hold=cinza, someday=cinza, done=verde, archived=opaco)
- Kind — chip tinted (outcome=blue, evergreen=cinza)
- Horizon — chip tinted (H0/H1=accent, H2..H5 progressivamente mais opacos)
- Área — chip tinted no quadrante (mesmo padrão TaskPanel)

Popover de parent: lista projetos do mesmo user que NÃO têm parent_id. Search field se >10 projetos.

Botão "marcar concluído" só aparece se `kind === 'outcome'` e `status !== 'done'`.

### `src/components/projects/ProjectsView.tsx` (NOVO)

Recebe: `projects`, `mode`, `statusFilter`, `onSelect`.

Lógica de agrupamento:
- `mode='horizon'`: agrupa por `horizon`. Ordem fixa H0→H5. Coluna "sem horizonte" se algum projeto não tiver (não esperado, mas safe).
- `mode='area'`: agrupa por `areaId`. Cor do header do grupo = cor do quadrante da área. "sem área" no fim.
- `mode='flat'`: lista plana ordenada por `position` asc, depois `created_at` desc.

Sub-projetos são renderizados indentados sob o pai. Ordem dentro do grupo: pais primeiro, filhos imediatamente abaixo.

Filtro `statusFilter`:
- `active`: status='active' (default)
- `on_hold|someday|done`: filtro literal
- `all`: todos exceto archived

Empty state quando lista vazia: "Nenhum projeto neste filtro" + botão "+ novo".

### Tab Projetos no TasksPage

`TABS = ['Today','Inbox','Kanban','Lista','Projetos','Gantt']`. Tab "Projetos" renderiza `<ProjectsView mode='horizon' statusFilter='active' onSelect={openProjectPanel} />` em modo simplificado (sem toggle de mode dentro da tab). Link "ver tudo" no header → navigate('/projects').

### Card no DashboardPage

```typescript
<ProjectsCard projects={projects.filter(p => p.status === 'active').slice(0, 5)} />
```

Renderiza top 5 ativos (já vêm ordenados por position do endpoint). Click no card → navigate('/projects'). Click numa linha → abre ProjectPanel inline (mesmo padrão).

### Rota nova em `App.tsx`

```typescript
<Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
```

---

## Seção 4 — Integração com Tasks

### TaskPanel: criar projeto inline

No popover do chip "Projeto" (já existe em TaskPanel.tsx), adicionar item no fim da lista:
```jsx
{projects.map(p => <button>...</button>)}
<div className="popover-divider" />
<button className="popover-item-add" onClick={() => { close(); openProjectCreate() }}>
  <IconPlus size={12} /> novo projeto
</button>
```

`openProjectCreate` é um state lift no TasksPage que abre `<ProjectPanel isCreate />`. Quando salvar, novo projeto vira selectedProjectId da task em edição.

### TaskRow: cor do projeto

Atualmente `<span className="task-project">{project.name}</span>`. Adicionar dot antes:
```jsx
<span className="task-project">
  <span className="task-project-dot" style={{background: project.color}} />
  {project.name}
</span>
```

CSS: `.task-project-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 6px; }`

### `projects-list.ts` retorna agregados

Query atual é simples `select * from projects`. Trocar por:

```sql
select
  p.*,
  coalesce(t_open.cnt, 0) as task_open_count,
  coalesce(t_all.cnt, 0) as task_count,
  coalesce(c.cnt, 0) as child_count,
  coalesce(p.quadrant_override, a.quadrant) as resolved_quadrant
from projects p
left join lateral (
  select count(*) as cnt from tasks
  where project_id = p.id and archived = false and status not in ('done','cancelled')
) t_open on true
left join lateral (
  select count(*) as cnt from tasks where project_id = p.id and archived = false
) t_all on true
left join lateral (
  select count(*) as cnt from projects c2
  where c2.parent_id = p.id and c2.archived_at is null
) c on true
left join areas a on a.id = p.area_id
where p.user_id = $1 and p.archived = false
order by p.position asc, p.created_at desc
```

Implementação via supabase-js: usar `rpc` ou expressar como views. **Decisão pragmática:** criar view `v_projects_with_counts` na próxima migration (0012), endpoint chama a view. Mais limpo que SQL inline. Migration nova:

```sql
-- supabase/migrations/0012_projects_view.sql
create or replace view public.v_projects_with_counts as
select
  p.*,
  coalesce((select count(*) from tasks t where t.project_id = p.id and t.archived = false and t.status not in ('done','cancelled')), 0) as task_open_count,
  coalesce((select count(*) from tasks t where t.project_id = p.id and t.archived = false), 0) as task_count,
  coalesce((select count(*) from projects c where c.parent_id = p.id and c.archived_at is null), 0) as child_count,
  coalesce(p.quadrant_override, a.quadrant) as resolved_quadrant
from projects p
left join areas a on a.id = p.area_id;
```

Endpoint usa `from('v_projects_with_counts')` (precisa regenerar `database.ts` types via `npm run db:types`, ou tipa manual no mapper se preferir não rodar Supabase CLI).

---

## Seção 5 — Testes, migração, rollout

### Testes Vitest

**`api/_schemas/project.test.ts`** (NOVO):
- Status enum aceita 5 valores válidos, rejeita inválidos
- Kind enum aceita outcome/evergreen, rejeita outros
- Horizon enum aceita H0..H5, rejeita H6 ou outros
- color regex aceita `#abc`, `#abcdef`, rejeita strings sem `#`
- targetDate aceita `2026-05-20`, rejeita datetime
- ParentId aceita UUID, rejeita string qualquer

`projects-save.ts` validação de hierarquia 1-nível: deixar como **TODO** com comentário inline (mock de supabase é caro; adicionar quando refatorar pra integration tests).

### Migração de dados

Schema 0010 já adicionou todas as colunas. Trigger `projects_title_fallback_trigger` mantém `name`/`title` em sync.

**Nova migration 0012**: cria `v_projects_with_counts`. Não destrutiva. Pode rodar a qualquer momento.

Após aplicar migration, regenerar types:
```bash
npm run db:types
```

(se Supabase CLI não estiver configurado localmente, tipar manualmente no mapper — adicionado como fallback abaixo)

### Rollout incremental

1. **Backend** (~30 min):
   - Migration 0012 (view)
   - `api/_schemas/project.ts`
   - `api/projects-save.ts`, `api/projects-archive.ts`, `api/projects-complete.ts`
   - Refactor `api/projects-list.ts` (usa view)
   - Tipos: `domain.ts` Project estendido, `api.ts` ProjectSaveResponse
   - Tests: project.test.ts
   - Atualizar `dev-server.ts` com endpoints novos

2. **Hooks** (~15 min):
   - `useProjects.ts` extension (save/archive/complete + opts)

3. **Pages/components** (~1.5h):
   - `ProjectPanel.tsx`
   - `ProjectRow.tsx`
   - `ProjectsView.tsx`
   - `ProjectsPage.tsx`
   - `ProjectsCard.tsx` (Dashboard)

4. **Integração** (~30 min):
   - Tab "Projetos" em TasksPage
   - "+ novo projeto" no popover Project do TaskPanel
   - Dot no TaskRow

5. **CSS** (~30 min):
   - `.project-row`, `.project-card`, `.progress`, `.project-panel`, `.popover-divider`, `.task-project-dot`, indent de sub-projetos

6. **Verificação:**
   - `npm run build` — limpo
   - `npm run test -- --run` — todos verdes (incluindo project.test.ts novo)
   - Smoke local: criar projeto, editar, sub-projeto (1 nível), arquivar, completar outcome
   - Confirmar que existing TasksPage/Kanban modo Horizonte mostra projetos com horizon corretos

7. **Commit incremental** por peça, push pra master quando estável.

### Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Performance de view com subqueries em N projects | Aceitável até ~200 projetos. Index `tasks(project_id, archived, status)` se passar disso (medir antes). |
| Hierarquia 1-nível enforce só no handler | Single-user app, baixo risco. SQL direto raro. Aceitável. |
| `db:types` regen não disponível local | Tipar manualmente no mapper como fallback. View é pública, types mudam pouco. |
| User cria projeto sem área | Permitido (areaId opcional). UI mostra "sem área" no agrupamento area mode. Quadrant resolution falha graciosamente (resolvedQuadrant=null). |
| Outcome marcado done com tasks abertas ainda | Permitido. Não há validação. UI pode mostrar warning futuramente. |

### Pendências explícitas pra próxima fase

- Drag & drop reorder (position update via dnd-kit)
- Bulk operations
- Auto-complete project quando todas tasks done
- Notificação proximidade target_date
- Templates de projeto (clonar com tasks)
- Filtros avançados (full-text)
- Coach insights sobre projetos parados
- Gantt view (já tem tab placeholder em TasksPage)
