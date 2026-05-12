# Tasks AQAL — design da fase 2

**Status:** approved (brainstorming) → implementing
**Branch:** `claude/aqal-gtd-task-management-7uVV1`
**Predecessor:** AQAL fase 1 (commit 3870caa) — schema + áreas + mandala

## Objetivo

Tornar o módulo Tasks plenamente AQAL/GTD:
- Tasks ganham área, quadrante (override), contexto, energia, tempo estimado, due_at (timestamptz), scheduled_at, waiting_for, recorrência (rrule), parent_task_id
- Status set expandido para o vocabulário GTD completo
- Captura GTD dupla: rápida (texto cru → `inbox_items`) e estruturada (TaskPanel vazio)
- Classificação AQAL via Claude Haiku, sob demanda
- Kanban reorganizado por quadrante (mandala) com toggle pra status/área/horizonte/contexto
- Today view com filtro manual de contexto + energia
- TaskPanel reescrito como chips inline (zero formulário)

## Decisões de design (consolidadas no brainstorming)

| Decisão | Escolha |
|---|---|
| Escopo | Tudo de uma vez (núcleo + recorrência + quadrant_override + inbox) |
| Classificação AI | Híbrido sob demanda (botão "✨ classificar com AI" no panel) |
| Captura GTD | Dupla — QuickAdd rápido → `inbox_items`; "+ Tarefa estruturada" → TaskPanel vazio |
| Kanban default | Por quadrante (4 colunas I/IT/WE/ITS) com toggle pra status/área/horizonte/contexto |
| Today layout | Chips de contexto + energia no topo; filtra a lista; "scheduled hoje" sempre visível |
| TaskPanel | Chips inline clicáveis (cada chip abre popover) |

## Não-objetivos desta fase

- Hábitos, rituais, AI Coach, Weekly Reviews, Integrations UI — fases futuras
- Projects AQAL UI completa — esta fase só consome `area_id`/`quadrant_override` em projetos via `v_tasks_resolved`; CRUD completo de projetos AQAL fica pra próxima fase
- Briefing AQAL (preencher `briefed_for`/`content_md`/`context_snapshot` no gerador de briefing) — próxima fase
- External tasks (cache de outras contas Google) — próxima fase

---

## Seção 1 — Schema & API contracts

Schema já existe (migration 0010 + 0011). Esta seção documenta como a API consome o schema.

### `api/_schemas/task.ts` — TaskSaveSchema estendido

```typescript
export const TaskSaveSchema = z.object({
  // legados
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  notes: z.string().default(''),
  priority: z.enum(['high','med','low']).default('med'),
  projectId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // legacy compat
  startOffset: z.number().int().optional(),
  duration: z.number().int().optional(),
  dependsOn: z.array(z.string().uuid()).default([]),

  // status set expandido (mantém legados doing/blocked)
  status: z.enum([
    'inbox','next','doing','blocked','done',
    'waiting','scheduled','someday','cancelled',
  ]).default('inbox'),

  // AQAL/GTD novos (todos opcionais)
  areaId: z.string().uuid().optional(),
  quadrantOverride: z.enum(['I','IT','WE','ITS']).optional(),
  context: z.enum(['deep','shallow','social','criativo','somatico','offline']).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  timeEstimateMin: z.number().int().positive().optional(),
  dueAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  waitingFor: z.string().optional(),
  rrule: z.string().regex(/^FREQ=/).optional(), // RFC 5545 simplificado
  parentTaskId: z.string().uuid().optional(),
  source: z.enum(['manual','voice','email','briefing','coach','google']).default('manual'),
})
```

### `api/_schemas/inbox.ts` — novo

```typescript
export const InboxCaptureSchema = z.object({
  rawText: z.string().min(1).max(2000),
  source: z.enum(['manual','voice','email','briefing','coach','google']).default('manual'),
  externalRef: z.string().optional(),
})

export const InboxProcessSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['to_task','to_project','trash']),
  // se to_task: payload mínimo de task
  taskFields: z.object({
    title: z.string().min(1),
    projectId: z.string().uuid(),
    status: z.enum(['next','scheduled','someday','waiting']).default('next'),
    areaId: z.string().uuid().optional(),
    context: z.enum(['deep','shallow','social','criativo','somatico','offline']).optional(),
    energy: z.number().int().min(1).max(5).optional(),
    timeEstimateMin: z.number().int().positive().optional(),
    dueAt: z.string().datetime().optional(),
    scheduledAt: z.string().datetime().optional(),
    waitingFor: z.string().optional(),
  }).optional(),
})
```

### `api/_schemas/task-classify.ts` — novo

```typescript
export const TaskClassifyRequestSchema = z.union([
  z.object({ taskId: z.string().uuid() }),
  z.object({ inboxItemId: z.string().uuid() }),
])

// Resposta validada do Haiku
export const TaskClassifyResponseSchema = z.object({
  areaId: z.string().uuid().nullable(),
  context: z.enum(['deep','shallow','social','criativo','somatico','offline']).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  timeEstimateMin: z.number().int().positive().nullable(),
  rationale: z.string(),
  confidence: z.enum(['high','medium','low']),
})
```

### Endpoints

| Endpoint | Método | Função |
|---|---|---|
| `/api/tasks-list` | GET | **Refactor:** lê de `v_tasks_resolved` (inclui `resolved_quadrant`). Retorna campos novos no mapper. |
| `/api/tasks-save` | POST/PATCH | **Extend:** aceita campos novos. No completar com `rrule`, gera próxima instância. Google sync limitado a campos compatíveis. |
| `/api/tasks-archive` | PATCH | sem mudança |
| `/api/tasks-sync` | POST | sem mudança nesta fase |
| `/api/tasks-classify` | POST | **NOVO:** chama Haiku, atualiza `area_id/context/energy/time_estimate_min/ai_classified=true`, retorna task atualizada |
| `/api/inbox-list` | GET | **NOVO:** une `inbox_items` (processed=false) + `tasks` (status='inbox'). Estrutura unificada com `kind: 'inbox_item' \| 'task'`. |
| `/api/inbox-capture` | POST | **NOVO:** insere em `inbox_items`. Usado pelo QuickAdd rápido. |
| `/api/inbox-process` | POST | **NOVO:** transforma `inbox_item` em task ou projeto, marca `processed=true`. Ou descarta. |

### Geração de próxima instância recorrente (lógica em `tasks-save.ts`)

Quando uma task com `rrule != null` muda para `status='done'`:
1. Verificar idempotência: se já existir outra task com mesmo `rrule_parent_id` (ou apontando pra esta como raiz) com status NOT IN ('done','cancelled'), não gera (evita duplicação por duplo-click)
2. Calcular próxima ocorrência com lib `rrule` (npm)
3. Inserir nova task: copia `title/notes/area_id/quadrant_override/project_id/context/energy/time_estimate_min/rrule/tags/priority`
4. `due_at` = próxima ocorrência calculada
5. `status` = 'next'
6. `rrule_parent_id` = `rrule_parent_id` da task original se existir, senão `id` da task original (preserva raiz da série)
7. `source` = 'manual' (não é nova captura)

Não gera ahead. Sempre uma instância ativa por vez. Se `rrule.after(now)` retorna null (série terminou), só completa a task original sem gerar nova.

### Tipos compartilhados

**`src/types/domain.ts` — Task estendido (campos novos opcionais):**

```typescript
export type TaskStatus =
  | 'inbox' | 'next' | 'doing' | 'blocked' | 'done'
  | 'waiting' | 'scheduled' | 'someday' | 'cancelled'

export interface Task {
  // ... campos legados ...
  areaId?: string
  quadrantOverride?: Quadrant
  resolvedQuadrant?: Quadrant // só preenchido pela view v_tasks_resolved
  context?: TaskContext
  energy?: number
  timeEstimateMin?: number
  dueAt?: string
  scheduledAt?: string
  waitingFor?: string
  rrule?: string
  rruleParentId?: string
  parentTaskId?: string
  source: CaptureSrc
  aiClassified: boolean
}

export interface InboxItem {
  id: string
  userId: string
  rawText: string
  source: CaptureSrc
  externalRef?: string
  aiSuggestion?: { areaId?: string; context?: TaskContext; energy?: number; timeEstimateMin?: number; rationale: string }
  processed: boolean
  processedToTask?: string
  processedToProject?: string
  createdAt: string
  processedAt?: string
}

export type InboxEntry =
  | { kind: 'inbox_item'; data: InboxItem }
  | { kind: 'task'; data: Task }
```

---

## Seção 2 — Hooks & estado

### `src/hooks/useTasks.ts` — extensão

Manter assinatura atual. Save aceita TaskSaveInput estendido (já é). Adicionar:
- `classify(taskId)` → POST `/api/tasks-classify`, atualiza task no estado local
- `currentEnergy: number | null` e `currentContext: TaskContext | null` em estado local (persistido em localStorage `jp_today_filter`)

### `src/hooks/useInbox.ts` — novo

```typescript
export function useInbox() {
  const [entries, setEntries] = useState<InboxEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => { /* GET /api/inbox-list */ }, [])
  const capture = useCallback(async (rawText: string) => { /* POST /api/inbox-capture */ }, [])
  const process = useCallback(async (id: string, action, taskFields?) => { /* POST /api/inbox-process */ }, [])
  const remove = useCallback(async (id: string) => { /* process com action='trash' */ }, [])

  return { entries, loading, fetch, capture, process, remove }
}
```

### Areas no escopo de tasks

`useAreas` já existe. TaskPanel consome para popover de seleção. Lista flat (não hierárquica) ordenada por `position`.

---

## Seção 3 — UI components

### `src/components/tasks/TaskPanel.tsx` — reescrita (chips inline)

Layout:
```
[× fechar]                                          Tarefa
─────────────────────────────────────────────────────────
[título — textarea grande]
─────────────────────────────────────────────────────────
[● status]  [!prio]  [● Projeto]
[● Área]    [@contexto]  [⚡energia]  [⏱tempo]
[📅 due]    [+ scheduled]  [+ waiting]
[✨ classificar AI]  [+ recorrência]  [+ subtask de]
[#tag] [#tag] [+ tag]
─────────────────────────────────────────────────────────
[notas — textarea]
─────────────────────────────────────────────────────────
[arquivar]                                       [salvar]
```

Cada chip é botão. Click → popover ancorado:
- **status**: select 9 opções
- **prioridade**: alta/média/baixa
- **projeto**: select dos projetos do user
- **área**: select das áreas (com cor do quadrante)
- **contexto**: 6 chips em popover
- **energia**: 5 dots tap
- **tempo**: input number (min)
- **due**: datetime picker
- **scheduled**: datetime picker
- **waiting**: text input (quem)
- **recorrência**: select preset (diária/semanal/mensal/custom RRULE)
- **subtask**: select task pai (autocomplete)
- **classificar AI**: chama `useTasks().classify(taskId)`. Sempre apenas pré-preenche os campos no panel local (não persiste). Mostra `rationale` em tooltip. User confirma com botão "salvar". (Não auto-salva mesmo com `confidence='high'` — usuário está editando, decide explicitamente.)

Componente `Chip` reutilizável: `<Chip label icon active onClick><Popover>…</Popover></Chip>`.

Mobile-first: popover bottom-sheet em viewport <600px, popover ancorado em desktop.

### `src/components/tasks/KanbanView.tsx` — refactor

Adicionar prop `mode: 'status' | 'quadrant' | 'area' | 'horizon' | 'context'`. Default `quadrant`. Toggle no `kanban-mode-bar`: em desktop 5 chips inline; em mobile (`<600px`) vira segmented control de 2 linhas ou select dropdown (TBD na implementação UI). Estado persistido em `localStorage` `jp_kanban_mode`.

Função `getColumns(mode, tasks, areas, projects)`:
- `quadrant`: 4 colunas (I/IT/WE/ITS) por `task.resolvedQuadrant`
- `status`: 9 colunas (atuais + 4 novas)
- `area`: N colunas dinâmicas das áreas ativas
- `horizon`: agrupa por `project.horizon` da task → 6 colunas H0..H5 (tasks sem projeto vão pra "Sem horizonte")
- `context`: 6 colunas dos task contexts (+ "Sem contexto")

Card mostra: barra lateral cor=quadrante, título, meta=`status·@contexto·⚡energia·tempo` ou só os campos preenchidos.

Drag&drop só faz sentido em modo `status` e `quadrant`. Em outros modos, drag muda o atributo correspondente (drag em modo `area` muda `area_id`; em `quadrant` muda `quadrant_override`). Drag desabilitado em `horizon` e `context` na primeira versão (UX duvidoso).

### `src/components/tasks/TodayView.tsx` — refactor

Topo: chip bar com:
```
eu estou:  [@deep] [@shallow] [@social] [@criativo] [@somatico] [@offline]   ⚡[1] [2] [3] [4] [5]   [limpar]
```
Estado em localStorage. Multi-select pra contexto. Energia: select de range mínimo (ex: ≥3).

Lista filtrada:
- **Filtro ativo** (se `currentContext` ou `currentEnergy != null`): tasks open + energia compatível + contexto compatível
- **Scheduled hoje** (sempre visível, ignora filtro): tasks com `scheduled_at` hoje
- **Concluído hoje** (sempre visível): tasks com `completed_at` hoje

Cada row mantém o estilo atual + barra lateral cor=quadrante + meta de contexto/energia/tempo.

### `src/components/tasks/QuickAdd.tsx` — split em 2 modos

Componente vira:
```
[📥 captura rápida ............... ✨↵]  [+ tarefa estruturada]
```
- Input rápido: enter → POST `/api/inbox-capture` → toast "→ Inbox". Hint "captura primeiro, organiza depois"
- Botão "+ tarefa estruturada": abre TaskPanel vazio (modo create)

`parseInput` (lib/taskParser.ts) só é usado se a flag `JP_QUICKADD_LEGACY=true` (default false; mantido pra eventual rollback). Não importar mais por padrão.

### `src/components/inbox/InboxView.tsx` — novo

Lista de `InboxEntry[]`:
- `inbox_item`: card com `rawText`, ações `[→ task]` `[→ projeto]` `[🗑]`
- `task` (status='inbox'): card normal, abre TaskPanel ao clicar

Atalho: `→ task` abre TaskPanel pré-preenchido com `title=rawText`. Salvar marca `inbox_item.processed=true` e linka.

Adicionar tab "Inbox" em `src/pages/TasksPage.tsx`. TABS vira: `['Today','Inbox','Kanban','Lista','Gantt']`.

---

## Seção 4 — Inbox flow (GTD)

### Captura
- **QuickAdd rápido** (default em TasksPage): texto livre → `inbox_items.source='manual'`
- **Voz** (futuro): grava áudio, transcreve com Whisper, vira `inbox_items.source='voice'` — fora do escopo desta fase
- **Email/Briefing/Coach/Google** (futuro): outras fontes alimentam `inbox_items` automaticamente — fora do escopo

### Triagem (tab Inbox)

Cada item tem 4 caminhos:
1. **→ Task**: abre TaskPanel pré-preenchido, salvar processa o item
2. **→ Projeto**: abre ProjectPanel (pega só nome+área+horizon nesta fase) — minimal
3. **🗑 Trash**: marca `processed=true`, sem linkar
4. **✨ Classificar com AI**: pré-classifica (sugere área/context/energy) sem processar — útil quando você quer revisar a sugestão antes de virar task

API `POST /api/tasks-classify` aceita `?inboxItemId=` em vez de `taskId` quando o destino é classificar inbox_item.

### Tasks com status='inbox'

São tasks que entraram pela rota legada (QuickAdd antigo, Google sync, etc.) ou foram criadas manualmente sem decisão. Aparecem na tab Inbox com mesmo tratamento, mas o "trash" só muda status pra 'cancelled' (não deleta).

---

## Seção 5 — Recorrência

### Storage
- `tasks.rrule` text (RFC 5545 truncado: `FREQ=DAILY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR`)
- `tasks.rrule_parent_id` aponta pra primeira instância da série

### UX no panel
Chip "+ recorrência" abre popover com presets:
- Diária
- Dias úteis (Seg-Sex)
- Semanal (escolhe dia)
- Quinzenal (escolhe dia)
- Mensal (mesmo dia do mês)
- Custom (input RRULE com hint)

Após criada, chip vira "🔄 diária" (label preset) ou "🔄 custom".

### Geração
- Gerada lazy só ao completar instance atual
- Lib npm `rrule` para parsing/cálculo da próxima data
- Caso `rrule.after(now)` retorne null (série terminou), só completa a task original sem gerar nova

### Visualização no Kanban/Today
- Card mostra ícone 🔄 quando `rrule != null` ou `rrule_parent_id != null`

---

## Seção 6 — Migração & rollout

### Migração de dados
Nada a fazer. Schema pronto na 0010:
- Campos novos são `null` em tasks legacy → não aparecem na UI nova
- Triggers `tasks_aqal_sync_trigger` e `projects_title_fallback_trigger` mantém compatibilidade dos campos espelho (due_date↔due_at, name↔title)
- Backfill de `due_at` a partir de `due_date` já fez parte da migration

### Backfill opcional (não bloqueante)
Script utilitário `scripts/backfill-tasks-aqal.ts`:
- Pra toda task open com `area_id=null`, sugere área via Haiku (batch de 50, 1 chamada por task) e popula. Roda só se user pedir explicitamente. Não bloqueia release.
- `ai_classified=true` marcado nas processadas

### Rollout
1. **Backend** (esta noite, autônomo): schemas Zod, endpoints novos, refactor tasks-save/list, lib rrule, testes Vitest
2. **UI** (próxima sessão com Jorge): TaskPanel chips, KanbanView quadrant, TodayView filtros, QuickAdd dual, InboxView, tab Inbox
3. **Deploy**: ship pra staging, smoke test com user-test_jp, depois prod

### Testes
Vitest cobre:
- Zod schemas: validação de status set expandido, energy 1-5, rrule regex
- `tasks-classify`: parsing da resposta Haiku, fallback se inválida
- Geração rrule: cálculo de próxima ocorrência pra diferentes presets
- Inbox flow: capture → process → task

UI testada manualmente quando Jorge entrar.

### Métricas pós-deploy
Logging básico no `console` (sem analytics nesta fase):
- `[tasks-classify] confidence X for task Y`
- `[inbox-process] action=Z item=W`
- `[rrule-gen] next_due=X for task=Y rule=Z`

---

## Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Haiku retorna JSON inválido | Zod `safeParse` + fallback `{rationale, confidence:'low'}`, sem bloquear UX |
| `rrule` lib pesada no bundle | Usa só no backend (`api/tasks-save.ts`), não importa no frontend |
| Status `blocked` virou redundante com `waiting` | Mantém ambos por compat; UI agrupa `blocked+waiting` na mesma coluna no quadrant view |
| Drag em modo `area`/`quadrant` muda 2 campos diferentes — confunde | Documenta inline no popover do toggle ("arrastar nesta visão muda a área") |
| Google Tasks não entende status novos (waiting/scheduled/someday/cancelled) | Mapeia: waiting/scheduled/someday → 'needsAction'; cancelled → 'completed' (pra sumir do Google sem deletar) |
| Geração rrule duplicada se request batido | `rrule_parent_id + due_at` UNIQUE constraint? Não. Mitigação: checa na save handler se já existe instance ativa antes de gerar (`select count where rrule_parent_id=X and status not in (done,cancelled)`) |

## Pendências explícitas pra próxima fase

- Projects AQAL CRUD completo
- Hábitos + Rituais
- AI Coach
- Weekly Reviews
- Inbox: fontes voice/email/briefing/coach/google
- Briefing AQAL (preencher novas colunas)
- External tasks (cache outras contas)
