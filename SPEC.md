# JP App — Especificação Espinha

> Documento de referência completo do app. **Antes de criar qualquer feature**, leia o "Mapa de módulos" (§3), os "Primitivos compartilhados" (§5) e a tabela "Reusar antes de criar" (§6). 90% das funcionalidades novas se conectam a algo que já existe.

**Stack:** Vite 6 + React 19 + TypeScript strict + Vercel serverless + Supabase + Anthropic + Resend + Google APIs.
**Última atualização:** 2026-05-13 (pós-MVP Coach + cleanup pass).

---

## Índice

1. [Visão & filosofia](#1-visão--filosofia)
2. [Stack](#2-stack)
3. [Mapa de módulos](#3-mapa-de-módulos)
4. [Como os módulos conversam](#4-como-os-módulos-conversam)
5. [Primitivos compartilhados (backend + frontend)](#5-primitivos-compartilhados)
6. [Reusar antes de criar](#6-reusar-antes-de-criar-checklist)
7. [Data model completo](#7-data-model-completo)
8. [Padrões transversais](#8-padrões-transversais)
9. [Módulos em detalhe](#9-módulos-em-detalhe)
10. [Jobs em background (crons)](#10-jobs-em-background-crons)
11. [Anti-padrões](#11-anti-padrões)
12. [Débitos técnicos conhecidos](#12-débitos-técnicos-conhecidos)
13. [Setup & comandos](#13-setup--comandos)

---

## 1. Visão & filosofia

App pessoal único do Jorge (founder do STATE Innovation Center). Mobile-first PWA, identidade STATE forte.

**Princípios fundadores:**
1. **AQAL como espinha.** Toda task/projeto/hábito vive em um dos 4 quadrantes integrais — **I** (interior individual), **IT** (exterior individual/corpo), **WE** (interior coletivo/relações), **ITS** (exterior coletivo/sistemas). Resolução: `task.override > project.override > area.quadrant` (view `v_tasks_resolved`).
2. **GTD como engine operacional.** Horizons H0–H5, status (inbox/next/waiting/scheduled/doing/done/someday/cancelled), capture→process→engage. Inbox + classificação Haiku viram next-actions.
3. **Coach como sócio sênior.** Não é "assistente": tem voz própria (firme-mas-gentil, sem rodeios, letra minúscula), memória aprovada manualmente, participa do briefing matinal, faz check-ins, conversa via streaming SSE.
4. **Briefing matinal automatizado.** Cron 09:30 BRT: RSS + agenda + tasks + AQAL + parágrafo do coach → email.
5. **Local-first com sync best-effort.** Save local sempre sucede; push Google é try/catch (não falha o request).

**Decisões não-negociáveis:** TypeScript strict desde commit 0, Zod em todo handler, sem ORM (SQL puro via Supabase), sem Tailwind/shadcn (CSS variables próprias), JWT em cookie httpOnly (sem Supabase Auth), `getAnthropic()` singleton, `Promise.all` para fetches independentes.

---

## 2. Stack

```
Frontend:    Vite 6 + React 19 + React Router DOM 7
Linguagem:   TypeScript strict (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride)
Estilo:      CSS variables + CSS puro (globals.css é fonte da verdade visual)
Backend:     Funções serverless em api/*.ts (Vercel, NodeNext, ESM)
Validação:   Zod em todo handler /api/* (schemas compartilhados em api/_schemas/)
Banco:       Supabase (PostgreSQL) — SQL puro, sem ORM
Storage:     Supabase Storage — bucket note-audio
Tipos DB:    supabase gen types typescript → src/types/database.ts
Auth:        JWT próprio + cookie httpOnly + bcrypt
IA:          @anthropic-ai/sdk
             - Haiku   (claude-haiku-4-5-20251001) — classificação, parsing, extração
             - Sonnet  (claude-sonnet-4-6)         — chat do coach, parágrafo do briefing, check-ins
Streaming:   SSE para chat do coach
Email:       Resend
Cron:        Vercel Cron (vercel.json)
RSS:         rss-parser
IMAP:        imapflow (newsletters — schema pronto, ingest não implementado)
Google:      googleapis (Tasks, Calendar, People) — calendar, tasks, contacts, directory.readonly
Editor:      Tiptap (@tiptap/react + @tiptap/pm + @tiptap/starter-kit)
Estado:      Context API + hooks tipados (AuthProvider, CoachProvider são canônicos)
Drag&Drop:   @dnd-kit/core (Kanban de tasks)
Datas:       date-fns + date-fns-tz (timezone-aware)
Recorrência: api/_lib/rrule.ts (RRULE RFC 5545 para tasks recorrentes)
```

---

## 3. Mapa de módulos

| Módulo | Status | Tabelas próprias | Depende de | Integra com | Páginas | Hooks |
|---|---|---|---|---|---|---|
| **Auth** | produção | users | — | (todos consomem) | LoginPage | AuthProvider/useAuth |
| **AQAL/Areas** | produção | areas | users | Projects, Tasks, Habits, Coach, Briefing, Dashboard | AreasPage | useAreas |
| **Projects** | produção | projects + view v_projects_aggregate | Areas | Tasks, Briefing, Coach (memory.related_project_id) | ProjectsPage | useProjects |
| **Tasks** | produção | tasks, task_logs + view v_tasks_resolved | Projects, Areas, Contacts | Calendar (time-block), Briefing, Coach, Inbox | TasksPage | useTasks |
| **Inbox** | produção | inbox_items | Tasks, Projects | Tasks (process→task), Projects (process→project) | (tab em TasksPage) | useInbox |
| **Habits** | produção | habits, habit_logs | Areas | Coach (snapshot.todayHabits), Dashboard | (em DashboardPage) | useHabits |
| **Rituals** | produção | rituals, ritual_steps | Habits | — | — | useRituals |
| **Dashboard** | produção | view v_quadrant_last_7d | Tasks, Areas, Projects | — | DashboardPage | (consome dashboard-aqal) |
| **Calendar** | produção | calendars, calendar_events, event_logs | Google Calendar | Tasks (TaskPill overlay, source=task_block), Briefing, Coach | CalendarPage | useCalendars/useEvents |
| **Contacts** | produção | contacts, interactions | Google People | Tasks (contact_id), Briefing (birthdays), Coach (memory) | ContactsPage | useContacts |
| **Notes** | produção | notes, note_folders, note_tags, note_tag_map | Supabase Storage (note-audio) | — | NotesPage | useNotes/useNoteFolders/useNoteTags |
| **News** | produção | news_items, sources | RSS feeds | Briefing (curadoria) | NewsPage | useNews/useSources |
| **Briefing** | produção | briefings, newsletters | Tasks, Calendar, AQAL, Coach, News | — | BriefingPage | (consome briefing-history) |
| **Coach** | produção (MVP) | coach_profile, coach_memory, coach_memory_candidate, coach_log | Areas, Projects, Tasks (memory.related_*), AQAL snapshot, Habits | Briefing (paragraph), todos via CoachFab | (sheet/painel; perfil em ConfigPage) | CoachProvider/useCoach |
| **Reviews** | schema pronto, UI não | reviews | AQAL, Habits, Tasks | (futuro: coach gera) | — | — |
| **Integrations** | schema pronto, parcial | integrations, external_tasks | Google | Google sync já funciona via users.google_refresh_token; tabela é para multi-conta | — | — |

Total: **15 módulos**, **84+ endpoints**, **11 páginas**, **19 hooks**, **13 migrations** (0001–0013).

### Quem é a fonte de verdade de cada conceito

- **Quadrante de uma task:** `v_tasks_resolved.resolved_quadrant` (cascade override)
- **Status de project:** `projects.status_aqal` (enum); `projects.archived` legado
- **Status de task:** `tasks.status` (text+check, valores legados + AQAL)
- **Visibilidade de calendar:** `calendars.is_visible`
- **AQAL context (briefing + coach):** `api/_briefing-context.ts::fetchAqalContext()`
- **Coach snapshot (chat + check-in + briefing paragraph):** `api/_coach.ts::buildCoachSnapshot()`
- **Sistema prompt do coach:** `api/_coach.ts::buildSystemPrompt()` (com override por user em `coach_profile.system_prompt_override`)
- **Tempo local do user:** sempre `users.timezone` (default `America/Sao_Paulo`)

---

## 4. Como os módulos conversam

### Diagrama de fluxos

```
                    ┌────────────────────────────────────────┐
                    │              USER (Jorge)              │
                    └──────────────────┬─────────────────────┘
                                       │
                                       ▼
        ┌────────────────────────────────────────────────────────┐
        │  AREAS (4 quadrantes)  ◄────  raiz da hierarquia AQAL  │
        └─────┬───────────────────┬──────────────┬───────────────┘
              │ area_id           │ area_id      │ area_id
              ▼                   ▼              ▼
        ┌─────────────┐    ┌────────────┐  ┌──────────────┐
        │  PROJECTS   │    │   HABITS   │  │ COACH_MEMORY │
        │  (H1/H3)    │    │  (logs)    │  │ (related_*)  │
        └─────┬───────┘    └──────┬─────┘  └──────────────┘
              │ project_id        │
              ▼                   │
        ┌─────────────┐           │
        │    TASKS    │           │
        └─┬───────────┘           │
          │ contact_id            │
          ▼                       │
        ┌─────────────┐           │
        │  CONTACTS   │           │
        └─────────────┘           │
                                  ▼
        ┌──────────────────────────────────────────────────────┐
        │  v_tasks_resolved · v_quadrant_last_7d · v_projects_aggregate │
        └──────────────┬───────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────────────────────────┐
        │  fetchAqalContext()  ◄── consumido por Briefing + Coach │
        └──────────────────────────────────────────────────────┘

        INBOX  ─process→  TASKS or PROJECTS
        CALENDAR  ◄─auto──  TASKS (com dueDate ≠ done → task_block event)
        NEWS  ─curated─→  BRIEFING
        COACH (paragraph) ─→ BRIEFING
        BRIEFING ─resumo→ EMAIL (Resend)
        COACH (check-ins) ─cron→ COACH_LOG + EMAIL opcional
```

### Cruzamentos importantes (onde a vida é compartilhada)

| De → Para | Como | Onde |
|---|---|---|
| Tasks → Calendar | Tasks com `due_date` + status ativo viram event read-only com `source='task_block'`, `task_id` FK | `CalendarPage.tsx` converte via `taskToEvent()` |
| Inbox → Tasks/Projects | `inbox-process` move item para task ou project, marca `processed_to_task`/`processed_to_project` | `api/inbox-process.ts` |
| Tasks → Coach memory | `coach_memory.related_task_id` (e areaId/projectId) | tabela, sem FK enforcement cross-user (debt) |
| Calendar → Briefing | `calendar_events` do dia, filtrados por `calendars.is_visible` | `_briefing.ts` |
| Tasks → Briefing | Top 10 open tasks (status next/doing, archived=false, order by due_date) | `_briefing.ts` |
| AQAL → Briefing & Coach | `fetchAqalContext()` retorna `{ quadrants7d, areasOpen, topProjects, totals }` | `_briefing-context.ts` (consumido nos 2) |
| Coach memory → Coach prompt | Top 20 memórias por `relevance desc, last_referenced_at desc` no snapshot | `_coach.ts::buildCoachSnapshot` |
| Coach chat → Coach memory | Após idle 30s, frontend dispara `/api/coach-memory-extract` → Haiku propõe 3 candidatos → user aprova | hook `useCoach.triggerExtract()` |
| Briefing → Coach log | (opcional, debt) gerar `coach_log.kind='briefing'` para auditoria | não implementado |
| Habits → AQAL snapshot | `today's habit_logs` aparecem em `coach_snapshot.todayHabits` | `_coach.ts:90-97` |
| Contacts → Briefing | Birthdays format DD/MM (em `contacts.birthday`); UI BirthdaysStrip planejada, não implementada | debt |
| Google Tasks → Tasks | `tasks-sync` faz upsert em 2 passes: 1) ignoreDuplicates 2) updates parciais preservando edits locais | `api/tasks-sync.ts` |
| Google Calendar → calendar_events | `events-sync` full-range (-1m a +3m), upsert por `(user_id, google_event_id)` (syncToken reservado no schema, não usado ainda) | `api/events-sync.ts` |
| Google People → Contacts | `contacts-sync` dual-pass upsert (ignoreDuplicates + updates parciais excluindo company/role) | `api/contacts-sync.ts` |

---

## 5. Primitivos compartilhados

> Esta é a lista **canônica** do que existe. Antes de criar coisa nova, procure aqui.

### Backend — singletons & helpers

| Arquivo | Exporta | Use para |
|---|---|---|
| `api/_anthropic.ts` | `getAnthropic()`, `parseJsonFromLlm<T>()`, `htmlEscape()` | Cliente Claude (sempre), extrair JSON de resposta LLM, escapar HTML em email |
| `api/_supabase.ts` | `getSupabase()` | Cliente Supabase com service key (backend) |
| `api/_google.ts` | `getOAuthClient()`, `getOAuthUrl(state)`, `getAuthedClient(refreshToken)`, `GOOGLE_COLORS` | OAuth Google (Tasks/Calendar/People) |
| `api/_middleware.ts` | `requireAuth(req,res)`, `requireAdmin(req,res)`, `requireCron(req,res)` | Auth nos handlers; retornam `AuthUser \| null` ou `boolean` |
| `api/_env.ts` | `loadEnvFile(path)` (auto-loaded) | Carrega `.env.local` em dev |
| `api/_briefing.ts` | `generateBriefing(userId, email, today)`, `buildEmailHtml(params)`, `buildContentMarkdown(...)` | Pipeline completo do briefing |
| `api/_briefing-context.ts` | `fetchAqalContext(userId)` → `AqalContextSnapshot` | Snapshot AQAL compartilhado (briefing + coach) |
| `api/_coach.ts` | `buildCoachSnapshot()`, `buildSystemPrompt()`, `formatSnapshotForPrompt()`, `generateCoachParagraph()`, `mapCoachMemoryRow()`, `touchMemories()`, constantes (`COACH_MODEL`, `COACH_EXTRACTION_MODEL`, `SESSION_GAP_MINUTES`, `SNAPSHOT_TOP_MEMORIES`, `SNAPSHOT_TOP_TASKS`, `CHAT_CONTEXT_MSGS`) | Tudo do coach |
| `api/_lib/rrule.ts` | `nextOccurrence(rrule, after)` | RRULE recurrence (tasks) |
| `api/_schemas/` | Schemas Zod por domínio (task, event, contact, area, note, project, habit, coach, inbox, task-classify) | Validação obrigatória em todo handler |

### Frontend — providers, hooks, layout

| Arquivo | Exporta | Use para |
|---|---|---|
| `src/api.ts` | `api.get<T>()`, `api.post<T>()`, `api.patch<T>()`, `api.delete<T>()` | Todo fetch (inclui `credentials: 'include'` automático) |
| `src/hooks/AuthProvider.tsx` + `useAuth.ts` | `<AuthProvider>` + `useAuth()` | Estado de auth (loading, user, logout, refetch) |
| `src/hooks/CoachProvider.tsx` + `useCoach.ts` | `<CoachProvider>` + `useCoach()` | **Modelo canônico** de Provider rico (streaming, polling, optimistic updates) |
| `src/hooks/useTheme.ts` | `useTheme()` → `{ theme, toggle }` | Dark/light mode |
| `src/components/layout/Topbar.tsx` | `<Topbar title actions />` | Cabeçalho fixo de toda página |
| `src/components/layout/BottomNav.tsx` | `<BottomNav />` | Nav 7 itens fixos |
| `src/components/layout/Subtabs.tsx` | `<Subtabs tabs active onChange />` | Sub-navegação dentro de página (Tasks/Calendar) |
| `src/components/common/ThemeToggle.tsx` | `<ThemeToggle />` | Toggle visual de tema |
| `src/components/common/ConfirmDialog.tsx` | `<ConfirmDialog title message onConfirm onCancel dangerous? detail? />` | **Toda ação destrutiva passa por aqui** |
| `src/components/common/ErrorBoundary.tsx` | `<ErrorBoundary>` | Wrap em App.tsx |
| `src/components/common/Chip.tsx` | `<Chip>` | Tag/badge |
| `src/components/common/Icon.tsx` | `IconCalendar`, `IconClock`, `IconPause`, `IconRepeat`, `IconSparkle`, `IconTrash`, `IconArrowRight`, `IconInbox`, `IconPlus`, `EnergyDots` | Sistema de ícones SVG inline |
| `src/components/common/SyncStatus.tsx` | `<SyncStatus />` | Pill de status de sync (timestamp última sync) |
| `src/lib/dates.ts` | helpers de data/timezone | Toda formatação/parsing de datas |
| `src/types/domain.ts` | `QUADRANT_COLORS`, `QUADRANT_COLORS_SOFT`, `QUADRANT_COLORS_INK`, `QUADRANT_VARS`, `QUADRANT_LABELS`, `projectColorSoft()` | Cores AQAL — paleta Seda (I=lilás, IT=sage, WE=peach-warm, ITS=sky) |
| `src/lib/coach.ts` | `COACH_KIND_LABEL` | Label PT de memory kinds (fact/pattern/promise/concern/preference) |
| `src/lib/taskParser.ts` | `parseInput(text)` → `{ title, priority, dueDate, tags }` | NLP local de quick-add (PT/EN: !alta/!media/!baixa, hoje/amanhã, #tags) |
| `src/styles/globals.css` | CSS variables + classes utilitárias | Fonte da verdade visual |

### Padrões CSS (em globals.css)

| Classe | Uso |
|---|---|
| `.app` | Container raiz, padding-bottom 116px (reserva espaço pra nav) |
| `.content`, `.section`, `.section-title` | Estrutura de página (padding 24px, margin 36px) |
| `.btn`, `.btn-accent`, `.btn-ghost`, `.btn-danger` | Variantes de botão |
| `.icon-btn` | Botão 36×36 só com ícone |
| `.task-panel-overlay`, `.task-panel` | **Painel lateral 560px** (TaskPanel, EventPanel, ContactPanel, NotePanel, ProjectPanel todos usam) |
| `.task-field` | Form grid (90px label, 1fr input) |
| `.task-panel-notes` | Textarea no painel |
| `.confirm-overlay`, `.confirm-box` | Modal centralizado |
| `.subtabs` | Tabs fixadas no rodapé z-index 19 |
| `.kanban-col`, `.kanban-card` | Kanban (260px cols, dnd-kit) |
| `.toggle` | Switch on/off (theme) |
| `.empty-state` | Estado vazio padrão |
| `.sync-status` | Pill de timestamp de sync |

### CSS variables (em `:root` + `body.dark`) — Paleta Seda

> Redesign "ClickUp Seda" aplicado. Plano completo: `JP_App_Redesign_Implementation.md`.

```
--bg #FBF9F5 / #1A1714        creme-pérola / preto-tinta (light/dark)
--bg-elevated, --bg-subtle    superfícies elevadas / pílulas-inputs
--fg #3A352F / #E8DDD0        marrom-tinta / creme claro
--fg-muted, --fg-dim          texto secundário
--accent #DFD0EC (lilás)      cor de marca (Coach/AI)
--accent-ink, --accent-soft, --accent-faint
--cta-bg, --cta-fg            botão primário (inverte no dark)
--border, --border-light      separadores
--danger #9B6B73 (rosa-vinho) erros/destrutivo
--success #5C8159 (sage)      sucesso
--color-{rose,lilac,sky,peach,peach-warm,butter,sage}  7 cores funcionais
  translúcidas (alpha 0.6 light / 0.2 dark), cada uma com par -ink e -border
--gradient-coach{,-strong,-bar}  gradiente lilás→rosa→sky (fita do Coach)
--shadow, --overlay-bg, --nav-selected, --sync-green
--font-sans, --font-display, --font-mono   tokens de tipografia
```

**Tipografia:** Fraunces (`--font-display`, logo/títulos/voz do Coach em italic), General Sans (`--font-sans`, UI 13-14px), JetBrains Mono (`--font-mono`, labels/timestamps 9-10px uppercase). Substituíram Bebas Neue / Space Grotesk / Space Mono.

**Classes utilitárias novas:** `.chip`/`.chip-{cor}`, `.card`/`.card-coach`/`.card-focus`, `.kpi-*`, `.view-toggle`, `.filter-pill`, `.aqal-bar-*`, `.avatar`/`.avatar-{cor}`, `.coach-bubble`/`.user-bubble`, `.list-section-*`.

---

## 6. Reusar antes de criar — checklist

Quando você for desenvolver uma feature nova, percorra esta lista **antes** de começar:

### Estado compartilhado entre componentes
- [ ] Vai ser consumido em mais de 1 componente? → Provider + hook (modelo `CoachProvider`)
- [ ] É só de 1 lugar? → hook stateful local

### Chamar Claude
- [ ] Use `getAnthropic()` de `_anthropic.ts` (nunca `new Anthropic({apiKey})`)
- [ ] Resposta vai ser JSON? → `parseJsonFromLlm<T>(raw)`
- [ ] Modelo certo: **Haiku** para classificação/extração/parsing; **Sonnet** para chat/raciocínio/escrita criativa

### Email
- [ ] HTML escape no conteúdo: `htmlEscape(text)` (sempre)
- [ ] Resend via `process.env['RESEND_API_KEY']`, from = `RESEND_FROM_EMAIL` (default `briefing@state.is`)
- [ ] Layout: dark theme inline-styled (ver `_briefing.ts::buildEmailHtml`) — debt: extrair template comum

### Auth
- [ ] Handler começa com `const user = requireAuth(req, res); if (!user) return`
- [ ] Toda query DB filtra por `user_id = user.id`
- [ ] Cron: `requireCron(req, res)` retorna boolean
- [ ] **Nunca** instancie JWT manualmente; **nunca** use localStorage pra token

### Snapshot AQAL ou coach
- [ ] Precisa do contexto AQAL do user? → `fetchAqalContext(userId)` em `_briefing-context.ts`
- [ ] Precisa do snapshot do coach (memories+aqal+tasks+events+habits)? → `buildCoachSnapshot()` em `_coach.ts`
- [ ] Vai gerar texto pelo coach? → `buildSystemPrompt(snapshot, userName)` em `_coach.ts`

### UI de edição
- [ ] Vai ter painel lateral pra editar? → use overlay `.task-panel-overlay` + `.task-panel` (estilos em globals.css). Examples: TaskPanel, EventPanel, ContactPanel, NotePanel, ProjectPanel. **Debt:** ainda não tem um `<Panel>` base; cada um duplica header/body/actions.
- [ ] Sheet de baixo pra cima (mobile)? → `CoachSheet` é o único exemplo (92vh, border-top-radius 16px)
- [ ] Ação destrutiva? → `<ConfirmDialog dangerous />`
- [ ] Topbar com ações? → extrair `actions` para variável antes do return

### Validação backend
- [ ] Toda rota POST/PATCH: schema Zod em `_schemas/` → `safeParse(req.body)` → 400 com `issues[0].message`
- [ ] Tipo exposto via `export type XxxInput = z.input<typeof XxxSchema>`

### Datas
- [ ] Use date-fns + date-fns-tz para timezone (sempre `users.timezone`, default `America/Sao_Paulo`)
- [ ] Storage: `timestamptz` em UTC. UI: converter local com `format()` ou `formatInTimeZone()`
- [ ] Para "início/fim do dia local" no backend: `fromZonedTime(${date}T00:00:00, tz).toISOString()`

### Recorrência (RRULE)
- [ ] Tasks recorrentes usam `tasks.rrule` (RRULE RFC 5545) + `tasks.rrule_parent_id`
- [ ] Próxima ocorrência: `nextOccurrence(rrule, after)` em `_lib/rrule.ts`

### Soft-delete
- [ ] Padrão: coluna `archived` (bool) + `archived_at` (timestamptz). Listas sempre filtram `archived = false`
- [ ] Algumas tabelas usam só `archived_at IS NULL` (areas, projects, habits)
- [ ] Rituals usam `active = true` (inconsistência — debt)

### Upsert + Google sync
- [ ] Tabela precisa ter UNIQUE CONSTRAINT (não partial index) pro arbiter
- [ ] Pattern dual-pass: 1) `ignoreDuplicates: true` (insert) 2) sem ignoreDuplicates + subset de campos (preserva edits locais)
- [ ] Write-back pra Google é best-effort: `try/catch + console.error`, nunca falha o request

### Tags
- [ ] **Inconsistência:** Notes usam junction `note_tag_map`; Tasks e Contacts usam `tags text[]`. Ao criar feature nova com tags, prefira junction se vai precisar de query relacional; mantenha array se for só display.

### Quadrant cascade
- [ ] Calcular quadrante de uma task? → use `v_tasks_resolved.resolved_quadrant` (não calcule no app)
- [ ] Tela de dashboard? → `v_quadrant_last_7d` agrega completion 7d por quadrante
- [ ] Projects? → `v_projects_aggregate` traz open/done/pct

### Tipos
- [ ] Frontend: `src/types/domain.ts` (negócio), `src/types/api.ts` (responses), `src/types/database.ts` (gerado)
- [ ] Backend: `import type { Database } from '../src/types/database.js'` (ou só os tipos da row da tabela)
- [ ] `exactOptionalPropertyTypes`: nunca `key: value | undefined` — use spread-conditional `...(val != null ? { key: val } : {})`

---

## 7. Data model completo

13 migrations em ordem (`supabase/migrations/`):

### Migration 0001 — schema inicial
- `users` (id, email, password_hash, name, city, timezone, google_refresh_token, anthropic_api_key, theme, coach_last_read_at)
- `projects` (legacy: id, user_id, name, color, google_task_list_id, archived) — extensões AQAL em 0010
- `contacts` (first_name, last_name, company, role, email, phone, address, birthday DD/MM, tags text[], phase, next_contact, notes, google_contact_id, synced, archived, archived_at)
- `interactions` (contact_id, date, type [call/meeting/email/message], note)
- `tasks` (legacy: title, notes, status text, priority, tags text[], due_date, depends_on uuid[], google_tasks_id, synced, archived) — extensões AQAL em 0010
- `task_logs` (audit; pouco usado)
- `sources` (RSS: name, url, active, last_fetch)
- `newsletters` (IMAP: sender_email, active — ingest não implementado)
- `briefings` (legacy: date, highlight, content jsonb, email_sent, model, token_count, cost) — extensões em 0010 e 0013

### Migration 0002 — Calendar
- `calendars` (google_calendar_id, summary, custom_color, is_primary, is_visible, is_default_for_create, access_role, sync_token, last_sync_at)
- `calendar_events` (calendar_id, google_event_id, summary, description, location, start_at, end_at, all_day, timezone, status, recurrence[], recurring_event_id, attendees jsonb, source [google/jp_app/task_block], task_id FK tasks, etag)
- `event_logs` (audit; latente)

### Migrations 0003–0007 — constraints + fix
- 0003: unique `(user_id, google_event_id)` em calendar_events
- 0004 + 0005: unique constraint em `(user_id, google_contact_id)` em contacts (arbiter pra upsert)
- 0006: unique `(user_id, google_tasks_id)` em tasks
- 0007: função sync_contacts obsoleta (não usada)

### Migration 0008 — Notes
- `note_folders` (parent_id self-ref, name)
- `note_tags` (name, color #hex)
- `notes` (folder_id, type [postit/text/audio/link], title, content text, url, thumbnail_url, audio_duration int, pinned, archived)
- `note_tag_map` (junction)

### Migration 0009 — News
- `news_items` (source_id, title, url, summary, content, author, image_url, published_at, favorited, read) + unique `(user_id, url)`

### Migration 0010 — AQAL + GTD (a maior — espinha)
**ENUMs criados:**
- `quadrant` (I, IT, WE, ITS)
- `horizon_lvl` (H0, H1, H2, H3, H4, H5)
- `task_context` (deep, shallow, social, criativo, somatico, offline)
- `project_kind` (outcome, evergreen)
- `project_status_aqal` (active, on_hold, someday, done, archived)
- `habit_dose` (full, min, skip)
- `coach_kind` (briefing, check_in, callout, celebration, chat, review)
- `memory_kind` (fact, pattern, promise, concern, preference)
- `capture_src` (manual, voice, email, briefing, coach, google)

**Tabelas novas:**
- `areas` (parent_id, name, slug, quadrant, vision_h4, color, icon, position, archived_at) — unique `(user_id, slug)`
- `habits` (area_id, identity, title, action, min_dose, cue, reward, quadrant, cadence jsonb, schedule_time, stack_after_habit_id, active, archived_at)
- `habit_logs` (habit_id, done_on date, dose, note) — unique `(habit_id, done_on)`
- `rituals` (name, trigger_time, description, active)
- `ritual_steps` (ritual_id, position, habit_id OR custom_step, estimated_min)
- `inbox_items` (raw_text, source, external_ref, ai_suggestion jsonb, processed, processed_to_task FK, processed_to_project FK)
- `external_tasks` (provider, external_list_id, external_id, title, notes, status, due_at, completed_at, last_synced_at) — pra Google Tasks de contas secundárias (não usado na main flow ainda)
- `integrations` (provider, account_email, scopes, expires_at, status, last_synced_at, metadata) — genérica, ainda parcial
- `tags` + `task_tags` + `project_tags` (junction relacional — coexiste com `tasks.tags text[]` antigo, **debt**)
- `coach_profile` (PK user_id; name, tone, voice_examples, values_md jsonb, boundaries, check_in_schedule jsonb, system_prompt_override, north_star_md, h3_goals jsonb)
- `coach_memory` (kind, content, source, related_area_id/project_id/task_id, relevance 0-100, expires_at, last_referenced_at)
- `coach_log` (kind, direction [coach_to_user/user_to_coach], content_md, context_snapshot, resulted_in, model_used, tokens_in, tokens_out)
- `reviews` (week_start, quadrant_distribution jsonb, habit_completion jsonb, metrics, alerts, insights_md) — UI não implementada

**Colunas adicionadas:**
- `projects`: area_id, parent_id, title (sync com name via trigger), outcome, kind, status_aqal, quadrant_override, horizon, target_date, metadata, position, completed_at, archived_at
- `tasks`: area_id, parent_task_id, quadrant_override, context, energy (1-5), time_estimate_min, waiting_for, due_at (sync com due_date via trigger), scheduled_at, completed_at (auto via trigger), rrule, rrule_parent_id, source, external_id, position, ai_classified
- `tasks.status` widened (check constraint): inbox, next, doing, blocked, done, waiting, scheduled, someday, cancelled
- `briefings`: briefed_for, content_md, context_snapshot jsonb, external_tasks_count, model_used, delivered_at, opened_at

**Triggers:**
- `set_updated_at()` — genérico (todas tabelas com updated_at)
- `tasks_aqal_sync_trigger` — sincroniza `due_date ↔ due_at`; auto-set `completed_at` quando status=done
- `projects_title_fallback_trigger` — `name → title` em inserts/updates onde title é null

**Views:**
- `v_tasks_resolved` — tasks + `resolved_quadrant` (cascade override)
- `v_quadrant_last_7d` — agregação 7d por user × quadrant (completed count, minutes)

### Migration 0011 — seed_default_areas()
Função idempotente que cria 12 áreas iniciais para um user (9 top-level + 3 nested). Quadrantes distribuídos: I (3), IT (1), WE (2), ITS (3). Chamada no onboarding.

### Migration 0012 — v_projects_aggregate
View com counts: `task_open_count`, `task_count`, `child_count`, `resolved_quadrant` (cascade via area). Consumido por `projects-list`, briefing, dashboard.

### Migration 0013 — Coach chat MVP
- `coach_memory_candidate` (source_log_id FK coach_log, kind, content, relevance, expires_at, status [pending/accepted/dismissed], decided_at) — staging das extrações Haiku
- `users.coach_last_read_at` — pro badge unread
- `briefings.coach_paragraph` — parágrafo do coach no topo do briefing
- `coach_log.conversation_id` (uuid, opcional, sem FK ainda)
- Index `coach_log_user_kind_recent_idx`

### Padrões de schema (recap)
- IDs sempre `uuid` (`gen_random_uuid()`)
- Timestamps `timestamptz` (`created_at`, `updated_at`)
- Multi-tenant: todo query filtra por `user_id = auth user.id` (service key bypassa RLS, então é regra nos handlers)
- Soft-delete: `archived_at` (preferido) ou `archived bool` (legado) ou `active bool` (rituals — debt)
- Flexibilidade: `jsonb` para metadata/cadence/ai_suggestion/context_snapshot/h3_goals/values_md
- Position: `int` para ordens manuais (areas, projects, tasks, ritual_steps)

---

## 8. Padrões transversais

### 8.1 IA (Anthropic)

**Sempre via `getAnthropic()` em `api/_anthropic.ts`. Sempre.**

```typescript
import { getAnthropic, parseJsonFromLlm, htmlEscape } from './_anthropic.js'

const msg = await getAnthropic().messages.create({
  model: 'claude-haiku-4-5-20251001',   // ou claude-sonnet-4-6
  max_tokens: 512,
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: prompt }],
})
const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
const parsed = parseJsonFromLlm<{ items: Item[] }>(raw)  // null em falha
```

**Modelos:**
- **Haiku** — classificação, parsing, extração: `tasks-classify`, `events-parse`, `coach-memory-extract`, briefing news curation
- **Sonnet** — chat, escrita criativa, raciocínio longo: `coach-chat` (streaming), `coach-checkin-cron`, `generateCoachParagraph`

**Telemetria:** `briefings` e `coach_log` têm colunas `model_used`, `tokens_in`, `tokens_out`.

### 8.2 Streaming SSE (chat do coach)

Backend `api/coach-chat.ts`:
```typescript
res.setHeader('Content-Type', 'text/event-stream')
res.flushHeaders?.()
const send = (type, data) => res.write(`data: ${JSON.stringify({type, ...data})}\n\n`)
const stream = getAnthropic().messages.stream({...})
req.on('close', () => { try { stream.controller.abort() } catch {} })  // aborta + persiste parcial
for await (const event of stream) { ... send('delta', { text }) ... }
send('done', { userMsgId, coachMsgId, coachCreatedAt, ... })  // troca temp-IDs in-place
```

Frontend (`CoachProvider`): `fetch` → `getReader()` → `TextDecoder` → split por `\n\n` → handler por evento. Veja `src/hooks/CoachProvider.tsx::sendMessage`.

### 8.3 Local-first + Google write-back best-effort

```typescript
// Local sempre sucede
const { data: row } = await supabase.from('events').insert(...).select().single()

// Google é try/catch separado
try {
  const refreshToken = (await supabase.from('users').select('google_refresh_token').eq('id', user.id).single()).data?.google_refresh_token
  if (!refreshToken) { console.warn('[save] no refresh token'); return res.status(200).json({ event: row }) }
  const calendar = google.calendar({ version: 'v3', auth: getAuthedClient(refreshToken) })
  await calendar.events.insert({...})
} catch (e) {
  console.error('[save] google push failed:', e instanceof Error ? e.message : e)
}
return res.status(200).json({ event: row })
```

### 8.4 Sync incremental (Google) — dual-pass upsert

Quando trazer dados de Google (Tasks, Contacts, Calendar):
```typescript
// Pass 1: insere novos (ignora colisão)
await supabase.from('contacts').upsert(rows, {
  onConflict: 'user_id,google_contact_id',
  ignoreDuplicates: true,
})

// Pass 2: atualiza existentes só com campos canônicos do Google
//          (preserva edits locais em campos como tags/notes/company/role)
await supabase.from('contacts').upsert(rowsSubset, {
  onConflict: 'user_id,google_contact_id',
  ignoreDuplicates: false,
})
```

**Requer UNIQUE CONSTRAINT** (não partial index) como arbiter.

### 8.5 Provider único + hook consumer (canônico)

`CoachProvider` é o modelo. Para domínios que precisam de estado compartilhado entre múltiplos componentes (FAB + Sheet + List + Painel):

```tsx
// src/hooks/XxxProvider.tsx
export const XxxContext = createContext<XxxContextValue | null>(null)
export function XxxProvider({ children }) {
  const { user } = useAuth()  // gating por auth
  const [state, setState] = useState(...)
  const fetchAll = useCallback(async () => { if (!user) return; ... }, [user])
  useEffect(() => { void fetchAll() }, [fetchAll])
  // mutações, polling com change-detection
  return <XxxContext.Provider value={{...}}>{children}</XxxContext.Provider>
}

// src/hooks/useXxx.ts
export function useXxx() {
  const ctx = useContext(XxxContext)
  if (!ctx) throw new Error('useXxx must be used within XxxProvider')
  return ctx
}

// src/App.tsx
<AuthProvider>
  <XxxProvider>
    <AppRoutes />
  </XxxProvider>
</AuthProvider>
```

**Anti-padrão:** Hook stateful (`useTasks`, `useNotes`, etc.) chamado em N componentes — cada um cria sua cópia de estado e timers. Hoje **a maioria dos hooks domain ainda é stateful** (debt — converter quando o domínio for usado em múltiplos componentes simultâneos).

### 8.6 Cron + idempotência

```typescript
// vercel.json
{ "crons": [{ "path": "/api/briefing-cron", "schedule": "30 9 * * *" }] }

// api/briefing-cron.ts
export const maxDuration = 300  // segundos
export default async function handler(req, res) {
  if (!requireCron(req, res)) return
  // itera users; idempotência via marker ou (user_id, date) check
}
```

### 8.7 Mapeamento snake_case ↔ camelCase

Backend Row interface (snake_case) ⇄ DTO (camelCase, spread-conditional para nullables):

```typescript
interface CoachMemoryRow { id: string; user_id: string; kind: string; ...; expires_at: string | null }
export function mapCoachMemoryRow(r: Partial<CoachMemoryRow>): CoachMemoryDto {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    kind: r.kind,
    relevance: r.relevance,
    createdAt: r.created_at,
    ...(r.expires_at != null ? { expiresAt: r.expires_at } : {}),
    ...(r.last_referenced_at != null ? { lastReferencedAt: r.last_referenced_at } : {}),
  }
}
```

### 8.8 Quadrant cascade

```sql
-- v_tasks_resolved
coalesce(t.quadrant_override, p.quadrant_override, a.quadrant) as resolved_quadrant
```

Sempre que precisar do quadrante de uma task, **leia da view, não calcule no app**.

### 8.9 RRULE recurrence

Tasks recorrentes:
- `tasks.rrule` (string RFC 5545, ex: `FREQ=DAILY;BYDAY=MO,WE,FR`)
- `tasks.rrule_parent_id` (FK pra task que iniciou a série)
- Quando uma task com `rrule` vira `done`: `tasks-save` chama `nextOccurrence(rrule, after)` em `_lib/rrule.ts`, cria próxima instância com `status='next'`, `due_at=next`, mesmo `rrule_parent_id`. Idempotente: cancela se já existe outra instância aberta na série.

---

## 9. Módulos em detalhe

### 9.1 Auth

**Tabela:** `users` (PK id uuid). Campos: email (unique), password_hash (bcrypt), name, city, timezone (default `America/Sao_Paulo`), google_refresh_token, anthropic_api_key (opcional, per-user), theme (light/dark), coach_last_read_at.

**Endpoints:**
- `POST /api/auth-login` — `{ email, password }`, bcrypt.compare, jwt.sign payload `{ id, email, name, timezone, theme }`, `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=7d`
- `POST /api/auth-logout` — `Set-Cookie: token=; Max-Age=0`
- `GET /api/auth-me` — devolve `{ user }`

**Frontend:** `AuthProvider` chama `/api/auth-me` no mount. `useAuth()` expõe `{ user, loading, logout, refetch }`.

**Google OAuth (não é login do app, só escopos de API):**
- `GET /api/google-oauth?action=url` — devolve URL de consent
- `GET /api/google-oauth?code=...` — callback; salva `refresh_token` em `users.google_refresh_token`
- Escopos: `calendar`, `tasks`, `contacts`, `directory.readonly`

### 9.2 AQAL / Areas

**Conceito:** Áreas de vida partitioned por quadrantes integrais (H2). Raiz da hierarquia AQAL — Projetos e Tasks herdam quadrante via cascade.

**Quadrantes:**
- **I** (Interior Individual) — mente, espírito, autoconhecimento, criatividade interna [#a78bfa]
- **IT** (Exterior Individual / Comportamental) — corpo, ações, hábitos físicos [#34d399]
- **WE** (Interior Coletivo / Cultural) — relações, comunidade, valores [#fb923c]
- **ITS** (Exterior Coletivo / Sistemas) — sistemas, organizações, produtos, tecnologia [#60a5fa]

**Tabela `areas`:** parent_id (1+ níveis), name, slug, quadrant, vision_h4 (3-5y), color, icon, position, archived_at. Unique `(user_id, slug)`.

**Seed** (`seed_default_areas()`): 12 áreas idempotente.

**Endpoints:** `areas-list`, `areas-save`, `areas-archive`.

**Hook:** `useAreas()` → `{ areas, loading, save, archive, refetch }`.

**Página `AreasPage`:** agrupa por quadrante (I → IT → WE → ITS), hierarquia visual. Editor inline (auto-slugify, color picker, vision_h4 textarea). Confirm dialog em archive.

**Integra:** Projects (area_id), Tasks (area_id direto + cascade via project.area_id), Habits (area_id), Coach memory (related_area_id), Briefing (areasOpen), Dashboard (mandala).

### 9.3 Projects

**Conceito:** Outcomes (time-boxed) ou Evergreens (perenes). Horizonte primário H1.

**Tabela `projects`** (legacy 0001 + AQAL 0010): id, user_id, area_id, parent_id (1-level), name (legado, sync com title), title, outcome, kind (outcome/evergreen), status_aqal (active/on_hold/someday/done/archived), quadrant_override, horizon (H0-H5), target_date, metadata jsonb, position, completed_at, archived_at, color, google_task_list_id.

**View `v_projects_aggregate`:** projects + `task_open_count`, `task_count`, `child_count`, `resolved_quadrant`.

**Endpoints:**
- `GET /api/projects-list?status=` (default active) — usa view, cria projeto "Inbox" se nenhum existir
- `POST/PATCH /api/projects-save` — valida parent (1-level only)
- `POST /api/projects-complete` — só outcome; seta status_aqal=done, completed_at=now()
- `POST /api/projects-archive` — archived_at=now(), status_aqal=archived

**Hook:** `useProjects({ status?, includeArchived? })`.

**Página `ProjectsPage` + components** (ProjectsCard, ProjectRow, ProjectPanel, ProjectsView).

**Integra:** Tasks (project_id), Areas (area_id), Briefing (topProjects do `_briefing-context`), Coach memory (related_project_id), Dashboard (counts), Calendar (não direto).

### 9.4 Tasks + Inbox

**Conceito:** Sistema GTD completo: capture (Inbox) → classify (Haiku ou manual) → engage (status doing → done).

**Tabela `tasks`** (0001 + 0010 + 0006): user_id, project_id, contact_id, area_id, parent_task_id, title, notes, status (enum widened: inbox/next/doing/waiting/scheduled/blocked/done/someday/cancelled), priority (high/med/low), tags text[], quadrant_override, context (deep/shallow/social/criativo/somatico/offline), energy (1-5), time_estimate_min, waiting_for, due_at + due_date (sync via trigger), scheduled_at, completed_at (auto on done), rrule + rrule_parent_id, source (capture_src enum), external_id, position, ai_classified, google_tasks_id, synced, depends_on uuid[], archived + archived_at.

**Triggers:** `tasks_aqal_sync_trigger` (due_date↔due_at + completed_at).

**View `v_tasks_resolved`:** tasks + `resolved_quadrant` (cascade).

**Endpoints:**
- `GET /api/tasks-list` — usa view, archived=false, order by created_at desc
- `POST/PATCH /api/tasks-save` — upsert; se status=done + rrule → gera próxima instância via `nextOccurrence()`; sync Google Tasks (best-effort)
- `POST /api/tasks-archive` — soft-delete
- `POST /api/tasks-classify` — Haiku classifica em areaId + context + energy + timeEstimateMin + rationale + confidence. Para task: seta `ai_classified=true`. Para inbox_item: armazena em `ai_suggestion` jsonb.
- `POST /api/tasks-sync` — pull Google Tasks (lists viram projects, tasks viram tasks). Dual-pass upsert (preserva edits locais em areaId, context, energy, tags, priority, contactId).

**Tabela `inbox_items`:** raw_text, source (capture_src), external_ref, ai_suggestion jsonb, processed, processed_to_task FK, processed_to_project FK.

**Endpoints inbox:**
- `POST /api/inbox-capture` — `{ rawText, source?, externalRef? }`
- `GET /api/inbox-list` — union de inbox_items (processed=false) + tasks (status=inbox)
- `POST /api/inbox-process` — `{ id, action: 'to_task'|'to_project'|'trash', taskFields? }`

**Hooks:** `useTasks()`, `useInbox()`.

**Página `TasksPage`** — tabs: Today / Inbox / Kanban / Lista / Projetos / Gantt (stub).

**Views (em `src/components/tasks/`):**
- **TodayView** — agrupa por due_at hoje + doing + next/inbox sem due. Filtros: chips de context (@deep/@shallow/@social/@criativo/@somatico/@offline), threshold de energy (≥1..≥5). Persiste filtro em localStorage. Seções: "Hoje", "Agendadas hoje", "Concluídas hoje".
- **KanbanView** — dnd-kit, 5 modos (quadrant/status/area/horizon/context). Cards com title, project (cor + nome), context, energy dots, time est, rrule icon. Persiste modo em localStorage.
- **ListView** — grupos por project ativo, sort por priority, sections "Sem projeto" + "Concluído".
- **QuickAdd** — barra "Capturar pra inbox" (Enter → `/api/inbox-capture`) + "+ tarefa" abre TaskPanel em create.
- **TaskPanel** — editor lateral completo. Botão "Classify" (Haiku). Cmd+S salva, Esc fecha.
- **TaskRow** — inline display com checkbox done, project dot, due label, context tag, energy dots, time est, rrule icon, priority dot.
- **InboxView** — seção "Capturas" (inbox_items) com badges `ai_suggestion` (IconSparkle), botões → task / → projeto / trash. Seção "Tasks status=inbox".

**NLP quick-add (`src/lib/taskParser.ts`):** reconhece priority (!alta/!media/!baixa, !p1/!p2/!p3 e EN equivalents), dates (hoje/amanhã), tags (#tag-name). Retorna `{ title, priority, dueDate, tags }`. **Debt:** parsed fields são preenchidos como defaults no TaskPanel, mas QuickAdd manda raw text pra inbox — não usa parser ainda.

**Integra:** Projects, Areas, Contacts (contact_id), Calendar (TaskPill overlay + source=task_block), Briefing (top open tasks), Coach memory (related_task_id), Inbox (process→task).

### 9.5 Habits + Rituals

**Habits** (`habits` + `habit_logs`): identity, title, action, min_dose (atomic dose), cue, reward, quadrant, cadence jsonb, schedule_time, stack_after_habit_id, active.

**Cadence jsonb (union de 5 tipos):**
```typescript
{ type: 'daily' }
{ type: 'weekdays' }                          // Mon-Fri
{ type: 'weekly', days: ['MO','TU',...] }
{ type: 'every_n_days', n: 2..30 }
{ type: 'monthly', dayOfMonth: 1..31 }
```

**Doses (atomic habits pattern):** `full` / `min` / `skip`. Streak conta full|min como completion.

**Endpoints:**
- `habits-list`, `habits-save`, `habits-archive`
- `POST /api/habit-logs-save` — upsert em `(habit_id, done_on)`; verifica ownership
- `GET /api/habits-streaks` — calcula currentStreak (walk backward skip non-due), longestStreak (90d sliding), doneToday, rateLast30. **Hot path** — não memoizado.

**Rituals** (`rituals` + `ritual_steps`): sequence de habits + custom steps. trigger_time, position ordering. `ritual_steps` check constraint: habit_id XOR custom_step.

**Hook:** `useHabits({ includeInactive? })` → `{ habits, streaks, save, archive, log, logToday, refetch }`. `useRituals()` análogo.

**Integra:** Coach snapshot (`todayHabits`), Dashboard, Reviews (futuro), Briefing (não direto ainda).

### 9.6 Dashboard

**Conceito:** Mandala AQAL visualizando completion por quadrante.

**Endpoint:** `GET /api/dashboard-aqal` — retorna `{ byQuadrant: [...], byArea: [...], totals: {...} }`. Lê `v_quadrant_last_7d` e agrega por área.

**Página `DashboardPage`:** grid 2×2 (corners labeled UL/UR/LL/LR). Background color por quadrante (opacidade 15-100% por activity). Espaço Mono labels. Lower section: por área com quadrant dot, completed ✓ + open ○.

**Integra:** consumido só pela DashboardPage; dados vêm de tasks (via view) e áreas.

### 9.7 Calendar

**Tabelas:** `calendars` (google_calendar_id, custom_color, is_primary, is_visible, is_default_for_create, access_role, sync_token reservado, last_sync_at) + `calendar_events` (google_event_id, summary, description, location, start_at, end_at, all_day, timezone, status, recurrence[], recurring_event_id, attendees jsonb, source [google/jp_app/task_block], task_id FK tasks, etag) + `event_logs` (audit, latente).

**Endpoints:**
- `GET /api/calendars-list` — lista user's calendars + `googleConnected` flag
- `POST /api/calendars-sync` — pull Google calendar list, upsert
- `POST /api/calendars-toggle` — `{ id, isVisible }`
- `GET /api/events-list?start=&end=`
- `POST/PATCH /api/events-save` — local-first + Google push best-effort
- `DELETE /api/events-delete`
- `POST /api/events-sync` — full-range (-1m a +3m). **syncToken reservado no schema mas não usado ainda** (debt). Sem 410 Gone handling.
- `POST /api/events-parse` — Haiku NLP. Output: `{ summary, startAt, endAt, allDay, location, calendarHint, confidence, notes }`. **`confidence` não roteado** (debt — todas vão pro preview).

**Hooks:** `useCalendars()`, `useEvents()` (não tem auto-fetch; `CalendarPage` chama `fetchRange()`).

**Views (componentes):** AgendaView, WeekView (24h × 60px/h grid, all-day strip), MonthView (6-week, 3+overflow), DayView, EventPanel (lateral, prefill from parse), EventBlock, CalendarPicker (horizontal scroll, per-cal checkbox + color swatch). QuickAddEvent (NLP bar).

**Time-blocking:** Tasks com `due_date + status≠done` viram events read-only `source='task_block'`, `task_id` FK, all_day=true, accent color + "✓" prefix. Click NÃO abre panel.

**Integra:** Tasks (TaskPill via taskToEvent), Briefing (today's events), Coach snapshot (todayEvents).

### 9.8 Contacts

**Tabelas:** `contacts` (first_name, last_name, company, role, email, phone, address, birthday DD/MM, tags text[], phase [prospect/first/talking/proposal/active/dormant], next_contact text, notes, google_contact_id unique, synced, archived, archived_at) + `interactions` (contact_id FK, date timestamptz, type [call/meeting/email/message], note).

**Endpoints:**
- `GET /api/contacts-list` — non-archived + `googleConnected`
- `POST/PATCH /api/contacts-save` — birthday regex `^\d{2}/\d{2}$`, Google People push best-effort (names/emails/phones/birthdays/organizations)
- `POST /api/contacts-sync` — Google People, paginated, dual-pass upsert (Pass 2 exclui company/role pra preservar edits)
- `POST /api/contacts-archive` — `{ id, archived }` + archived_at
- `GET /api/interactions-list?contactId=`
- `POST /api/interactions-save`

**Hook:** `useContacts()` → `{ contacts, googleConnected, save, archive, sync, refetch }`.

**Componentes:** ContactsList, FollowupsView (filtra por next_contact), PipelineView (kanban por phase: prospect → 1º Contato → Conversando → Proposta → Ativo → Adormecido + Sem fase), RelationshipsView (org-chart simples — SVG manual), ContactPanel (editor lateral com seção de interactions inline), InteractionModal.

**Integra:** Tasks (contact_id FK), Calendar (attendees — sem enforcement), Briefing (birthdays — implementação BirthdaysStrip parcial), Coach memory (potencial).

### 9.9 Notes

**Tabelas:** `note_folders` (parent_id self-ref) + `note_tags` (name, color #hex) + `notes` (folder_id, type [postit/text/audio/link], title, content text, url, thumbnail_url, audio_duration int, pinned, archived) + `note_tag_map` (junction).

**Endpoints:** `notes-list?folder=&type=&tag=&search=&archived=`, `notes-save`, `notes-delete`, `notes-upload` (audio → bucket `note-audio` path `${userId}/${noteId}.webm`, upsert=true), `note-folders-*`, `note-tags-*`.

**Hooks:** `useNotes()`, `useNoteFolders()`, `useNoteTags()`.

**Componentes:**
- **NoteEditor** — Tiptap (StarterKit only: bold, italic, h2, h3, lists, blockquote, code, paragraph, hard break). Output HTML.
- **AudioRecorder** — MediaRecorder webm chunking 100ms, timer mm:ss, onRecorded(blob, duration).
- **NoteCard** — grid item com type badge, title, preview (text strips HTML; audio MM:SS; link thumbnail), tag pills com color, pin button.
- **NotePanel** — lateral editor. Type tabs (lockados em edit). postit (textarea), text (Tiptap), audio (AudioRecorder ou playback), link (URL+title). Folder dropdown + tag picker. tempId para uploads pré-save.
- **FolderTree** — recursive (depth padding), expand subfolder, inline "nova pasta" input.
- **TagManager** — pill list + form com 10 preset colors.

**Tipos de note:**
- `postit` — plain text
- `text` — Tiptap HTML
- `audio` — content=audio_url, audio_duration em segundos
- `link` — content=title||url, url field, thumbnail_url **não populado automaticamente** (debt: sem OG scraper)

**Integra:** isolado hoje (potencial integração futura com Coach memory).

### 9.10 News + Sources

**Tabelas:** `sources` (RSS: name, url, active, last_fetch) + `news_items` (source_id, title, url, summary, content, author, image_url, published_at, favorited, read) com unique `(user_id, url)` + `newsletters` (sender_email, active — **ingest IMAP não implementado**, schema pronto).

**Endpoints:**
- `GET /api/news-list?source=&favorited=&limit=&offset=`
- `POST /api/news-fetch` — itera sources active, rss-parser, slice top 30, upsert com `ignoreDuplicates: true`
- `POST /api/news-favorite` — `{ id, favorited }`
- `POST /api/news-read` — `{ id }`
- `GET /api/sources-list`, `POST /api/sources-save` (type: 'source'|'newsletter'), `DELETE /api/sources-delete`

**Hooks:** `useNews()`, `useSources()`.

**Integra:** Briefing (curadoria Haiku top-3 global + top-3 brasil + highlight).

### 9.11 Briefing

**Tabela `briefings`** (0001 + 0010 + 0013): user_id, date (legacy) + briefed_for, highlight, content jsonb (`{ global, brasil, newsletters, agenda, tasks }`), content_md (compact markdown), context_snapshot jsonb (snapshot AQAL), coach_paragraph, email_sent, email_sent_at, delivered_at, opened_at, model_used, tokens_in/out.

**Endpoints:**
- `POST /api/briefing-generate` — gera briefing do dia (idempotência: pre-check `(user_id, today)` ou force=true para regerar)
- `POST /api/briefing-cron` — `requireCron`, itera users
- `GET /api/briefing-history?limit=`

**Pipeline (`api/_briefing.ts::generateBriefing`):**
1. Promise.all: sources, top-10 tasks, visible calendars, today's events, `fetchAqalContext()`
2. `generateCoachParagraph(userId, userName)` (Sonnet 4.6, async — falha graciosa retorna null)
3. RSS items via `fetchRssItems(url, max=5)` para cada source
4. Haiku monta `{ highlight, global, brasil, newsletters }` — `parseJsonFromLlm` para parsing seguro
5. `buildEmailHtml({...})` com inline styles (dark STATE branding) — coach block (border-left), AQAL bars (cor por quadrante, opacity por activity), agenda, tasks, news sections. `htmlEscape()` em todo conteúdo de LLM.
6. Resend send (try/catch, non-fatal)
7. INSERT em `briefings` + retornar GeneratedBriefing

**Failure modes:** RSS per-source falha → skip; coach paragraph falha → continua sem; email falha → registro persiste; context fetch falha → 500.

**Página `BriefingPage`:** histórico + regenerar, renderiza coach_paragraph no topo (border-left cyan), AQAL summary, agenda, tasks, news.

**Cron:** `30 9 * * *` (09:30 BRT), `maxDuration: 300`.

**Integra:** Tasks, Calendar, AQAL, Coach (paragraph), News, Sources, (futuro: IMAP newsletters).

### 9.12 Coach (módulo principal)

**Conceito:** "sócio sênior" do Jorge — não assistente. Voz firme-mas-gentil, sem rodeios, letra minúscula no início, sem emoji, sem ponto-de-exclamação enfático. Conhece valores, norte, H3 goals, áreas AQAL, memórias aprovadas, agenda e tasks do dia. NÃO cria tasks/notas (apenas sugere).

**Tabelas (0010 + 0013):**
- `coach_profile` (PK user_id): name, tone, voice_examples, values_md jsonb, boundaries, check_in_schedule jsonb `{ morning?, evening?, emailMorning, emailEvening, weeklyDay?, weeklyTime? }`, system_prompt_override, north_star_md, h3_goals jsonb.
- `coach_memory`: kind (memory_kind), content, source, related_area_id/project_id/task_id, relevance (0-100), expires_at, last_referenced_at.
- `coach_memory_candidate`: source_log_id FK coach_log, kind, content, relevance, expires_at, status (pending/accepted/dismissed), decided_at.
- `coach_log`: kind (coach_kind), direction, content_md, context_snapshot jsonb, resulted_in jsonb, model_used, tokens_in/out, conversation_id (sem FK ainda).

**Helpers (`api/_coach.ts`):**
- `buildCoachSnapshot({userId, userName, userTimezone?})` — Promise.all de 7 queries (profile, top-20 memories, AQAL context, top-10 tasks abertas, today's events, active habits, today's habit_logs)
- `formatSnapshotForPrompt(snapshot, userName)` — formata para texto
- `buildSystemPrompt(snapshot, userName)` — system prompt completo; se `systemPromptOverride` set, prepended
- `generateCoachParagraph(userId, userName)` — Sonnet, 120-180 palavras, retorna null em falha (usado pelo briefing)
- `mapCoachMemoryRow(row)` — Row → DTO com spread-conditional
- `touchMemories(userId, ids)` — fire-and-forget update `last_referenced_at`

**Endpoints:**
- `POST /api/coach-chat` — **SSE streaming** (Sonnet 4.6, max_tokens 1024). Eventos: `start` (com userMsgId real), `delta`, `done` (com userMsgId + coachMsgId + coachCreatedAt + tokens), `error`. Aborta em `req.on('close')` e persiste parcial.
- `GET /api/coach-chat-history?limit=&before=` — paginação
- `GET /api/coach-unread` — count de `coach_to_user` após `coach_last_read_at`
- `POST /api/coach-mark-read` — set `coach_last_read_at = now()`
- `POST /api/coach-memory-extract` — Haiku extrai 3 candidatos das últimas 20 msgs do diálogo (filtra por `sinceLogId`)
- `GET /api/coach-memory-pending` — candidatos status=pending
- `POST /api/coach-memory-accept` — promove para `coach_memory`, marca candidate=accepted (com editing opcional de content/kind/relevance/expiresAt)
- `POST /api/coach-memory-dismiss` — marca candidate=dismissed
- `GET /api/coach-memory-list` — memórias ativas (expires_at null ou futuro), order by relevance desc
- `POST/PATCH /api/coach-memory-save` — CRUD manual
- `POST /api/coach-memory-archive` — hard delete
- `GET/POST/PATCH /api/coach-profile`
- `POST /api/coach-checkin-cron` — `requireCron`, `*/15 * * * *`, janela ±15min, idempotência via marker `<!-- slot -->` no content_md, email opcional

**Provider (`src/hooks/CoachProvider.tsx`):** estado `{ profile, memories, messages, candidates, unread, loading }`. Polling unread 60s com change-detection. SSE `done` event traz IDs reais — troca temp-IDs in-place sem refetch.

**Componentes:**
- **CoachFab** (em todas rotas protegidas, dentro de ProtectedRoute) — botão flutuante bottom-right com badge unread, abre CoachSheet
- **CoachSheet** — bottom-sheet 92vh com chat, separadores de dia, candidates banner no topo, input com Enter-to-send. Triggera `extract` 30s após `done`.
- **CoachMemoryCandidates** — banner "coach propõe lembrar:" com aceitar/editar/descartar por item
- **CoachMemoryList** — lista memórias com kind label + relevance + archive button (em ConfigPage)
- **CoachProfilePanel** — form completo (em ConfigPage `?tab=coach`): nome, tom, valores, norte, limites, schedule (manhã/noite/semanal), email toggles, system_prompt_override

**Slot config (`coach-checkin-cron.ts`):** SLOT_CONFIG keyed por slot (morning/evening/weekly) → intro, structure, maxWords, subject, shouldEmail predicate.

**Integra:** AQAL (via fetchAqalContext), Tasks/Projects/Areas (memory.related_* + snapshot), Habits (snapshot.todayHabits), Calendar (snapshot.todayEvents), Briefing (paragraph), Resend (check-in emails).

### 9.13 Reviews (schema pronto, UI não)

**Tabela `reviews`:** week_start (unique per user), quadrant_distribution jsonb, habit_completion jsonb, metrics jsonb, alerts jsonb[], insights_md, model_used.

**Não implementado:** endpoints, UI, cron. Pensado para weekly review automático pelo coach.

### 9.14 Integrations (schema pronto, parcial)

**Tabela `integrations`:** genérica (provider, account_email, scopes, expires_at, status, last_synced_at, metadata jsonb). Pensada para multi-conta Google (várias contas de Tasks/Calendar/Contacts).

**Tabela `external_tasks`:** read-only cache de Google Tasks de contas não-primárias. Não populada na flow atual.

**Hoje:** sync Google usa `users.google_refresh_token` direto (1 conta). Migração para `integrations` é trabalho futuro.

---

## 10. Jobs em background (crons)

`vercel.json::crons`:

| Path | Schedule | maxDuration | Helper |
|---|---|---|---|
| `/api/briefing-cron` | `30 9 * * *` (09:30 BRT) | 300s | `_briefing.ts::generateBriefing` per user |
| `/api/coach-checkin-cron` | `*/15 * * * *` | 300s | `_coach.ts::buildCoachSnapshot` + Sonnet per user com slot ativo |
| `/api/calendars-sync` | `*/2 * * * *` | 60s | googleapis events.list, upsert |
| `/api/tasks-sync` | `*/5 * * * *` | 60s | dual-pass upsert preservando edits |
| `/api/contacts-sync` | `*/30 * * * *` | 60s | dual-pass upsert |
| `/api/news-fetch` | `0 * * * *` | 60s | rss-parser por source |

**Padrão:** Todo cron usa `requireCron(req, res)` que valida `Authorization: Bearer ${CRON_SECRET}`. Itera users serial (debt: paralelizar com concurrency cap quando multi-user crescer).

---

## 11. Anti-padrões

| ❌ Não fazer | ✅ Em vez disso |
|---|---|
| `new Anthropic({ apiKey })` em handler | `getAnthropic()` de `_anthropic.ts` |
| `raw.match(/\{[\s\S]*\}/) + JSON.parse` ad-hoc | `parseJsonFromLlm<T>(raw)` |
| `str.replace(/</g, '&lt;')` em email | `htmlEscape(str)` |
| `key: value ?? undefined` em objeto literal | `...(value != null ? { key: value } : {})` |
| Hook stateful chamado em N componentes | Provider único + hook consumer (modelo `CoachProvider`) |
| Refetch lista inteira após mutação pra pegar IDs | Retornar IDs no response + `setState` in-place |
| `supabase.from(...).catch(fn)` | `await + try/catch` ou `.then(null, fn)` |
| Sequential `await` em N fontes independentes | `Promise.all([...])` |
| Função de IA sem `maxDuration` no vercel.json | Sempre setar (chat=60, briefing/cron=300) |
| `localStorage` para auth token | Cookie httpOnly via `Set-Cookie` |
| Validar só no frontend | Zod no backend (`safeParse(req.body)`) obrigatório |
| `key={index}` em listas com edição | `key={item.id}` |
| Strings repetidas em handlers branchy | Config object keyed (ex: `SLOT_CONFIG`) |
| Calcular `resolved_quadrant` no app | `v_tasks_resolved` |
| Date.parse() / new Date() em strings sem timezone | `parseISO()` + `formatInTimeZone()` |
| Push pra Google bloqueando o save | Local-first + try/catch (best-effort) |
| Recarregar lista após classify Haiku | Updating `ai_classified` flag in-place |
| Comentário "// Step 1:" / "// Insere usuário" | Sem comentário; nome de função/variável já diz |
| `tags text[]` para tags relacionais novas | Junction table (como `note_tag_map`) |

---

## 12. Débitos técnicos conhecidos

Referência completa em `REVIEW.md`. Resumo rápido:

### Schema
- **Dual columns:** `tasks.due_date` ↔ `due_at`, `projects.name` ↔ `title` (sync via trigger; debt cosmético)
- **Status coexiste:** `tasks.status` (text+check) vs `projects.status_aqal` (enum)
- **Tags duplicadas:** `tasks.tags text[]` + `contacts.tags text[]` + tabelas `tags`/`task_tags`/`project_tags` — sistema novo não migrou os antigos
- **`note_folders.parent_id` sem proteção de ciclo**
- **Cross-user FK em `coach_memory_candidate.source_log_id`:** sem CHECK enforcing same-user (mas extract handler valida ownership)
- **`task_logs`, `event_logs` latentes:** schemas existem, não são populados
- **`active` flag vs `archived_at`:** inconsistência (rituals usam active, outros usam archived_at)
- **`event_logs.action` semântica:** definida mas não escrita

### Frontend
- **18 hooks domain stateful sem Provider:** se consumidos em múltiplos componentes simultâneos, duplica state e fetches. Converter quando o domínio tiver isso.
- **Painéis duplicam header/body/actions:** TaskPanel/EventPanel/ContactPanel/NotePanel/ProjectPanel — extrair `<PanelBase>` quando convergirem mais
- **Inline-style repetition** em CoachProfilePanel, CoachInput, CoachSheet, CoachMemoryCandidates — extrair classes utilitárias em globals.css
- **ISO ↔ local datetime conversion** repetido em panels — centralizar em `src/lib/dates.ts`
- **`taskParser.ts` não usado** pelo QuickAdd (parsed fields nunca preenchem TaskPanel)
- **`api/_schemas/index.ts` desatualizado:** não re-exporta coach, habit, inbox, project, task-classify

### Backend
- **`coach-chat.ts` history massaging (50 linhas)** sem testes — extrair `buildChatContext()` para `_coach.ts`
- **Cron serial cross-user:** quando crescer multi-user, paralelizar com concurrency cap respeitando rate-limit Anthropic
- **Email layout duplicado:** briefing + coach check-in compartilham header STATE inline — extrair `renderStateEmail({title, body})`
- **`coach-memory-list.ts select('*')`** — selecionar só colunas usadas
- **`coach-unread.ts` 2 round-trips:** read last_read_at + count — poderia ser RPC

### IA / Streaming
- **Streaming text re-renderiza lista inteira:** `setMessages(prev => prev.map(...))` por delta força re-render do day-grouping inteiro. Mover buffer para `useRef`/local state e commitar no `done`.
- **Auto-scroll em cada delta:** throttle com `requestAnimationFrame`

### Segurança (low priority, single-user OK)
- **Sem rate limit em `/api/coach-chat`:** token bucket quando multi-user
- **`requireCron` sem validação de env:** se `CRON_SECRET` vazio, request com `Bearer ` passa — throw na startup
- **`coach-chat` envia `error.message` ao client:** corrigido para genérico (vs detalhe nos logs)

### Integrações
- **Calendar `syncToken` reservado mas não usado** — implementar incremental + 410 Gone handling
- **Calendar `events-parse.confidence` ignorado pela UI** — rotear high → auto-create + undo toast
- **`calendarHint` parsed mas não casado com calendar list** — auto-select
- **`attendees jsonb` sync mas não renderizado nas views**
- **Recurrence read-only** (events) — UI não permite criar evento recorrente
- **Google Tasks status mapping incompleto:** só `done|cancelled → completed`; outros → `needsAction` (sem reverse mapping rico)
- **News dedup só por `(user_id, url)`** — title/content diff re-fetch
- **OG scraper para link notes não implementado** — thumbnail_url nunca populado

### Features mencionadas mas não implementadas
- **IMAP newsletter ingestion** (schema pronto)
- **BirthdaysStrip** no briefing (formato DD/MM existe em `contacts.birthday`)
- **Weekly Reviews** automáticos (tabela existe, sem UI/cron)
- **Multi-conta Google via `integrations`** (schema pronto, fluxo usa `users.google_refresh_token` ainda)
- **Time-blocking editável** (calendar_events.task_id existe e source='task_block' é renderizado, mas read-only)
- **PWA manifest + service worker**
- **Sentry/telemetria**

---

## 13. Setup & comandos

```bash
npm install
npm run dev              # Vite dev (frontend)
npm run dev:api          # tsx dev-server.ts (serverless local)
npm run build            # tsc -b && vite build
npm run preview          # serve build
npm run test             # vitest (139+ testes)
npm run db:types         # supabase gen types typescript → src/types/database.ts
vercel env pull          # baixa env vars
vercel dev               # alternativa: serverless local via Vercel CLI
```

### Variáveis de ambiente (todas obrigatórias salvo nota)

```
# Auth
JWT_SECRET             # 32+ chars aleatório

# Supabase
SUPABASE_URL
SUPABASE_SERVICE_KEY   # service_role (backend só)

# Anthropic
ANTHROPIC_API_KEY

# Resend
RESEND_API_KEY
RESEND_FROM_EMAIL      # opcional (default briefing@state.is)

# Cron
CRON_SECRET            # autorização dos crons

# Google OAuth (Tasks/Calendar/People)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI

# Opcional (futuro)
IMAP_HOST / IMAP_USER / IMAP_PASSWORD  # newsletter ingest
```

### Setup Supabase Storage

Criar bucket `note-audio` no dashboard:
- Storage → New Bucket → nome `note-audio`, Public: sim (URLs públicas para audio playback)
- Ou via SQL: `insert into storage.buckets (id, name, public) values ('note-audio', 'note-audio', true);`

### Fluxo de uma nova feature

1. **Procure no §3** se algum módulo já cobre o conceito
2. **Percorra o §6** (Reusar antes de criar) — onde estão singletons, hooks, providers, estilos, schemas, primitivos
3. **Mapeie integrações no §4** — o que essa feature consome / o que ela expõe pra outros módulos
4. **Decida schema novo** (migration) ou estende existente (mais comum) — siga padrões §7.10
5. **Backend:** Zod schema em `_schemas/`, handler com `requireAuth` + filtro `user_id`, write helpers em `_coach.ts`/`_briefing.ts` se IA, dual-pass upsert se sync externo
6. **Frontend:** se compartilhado entre componentes → Provider+hook; se local → hook stateful; usar `api.ts` wrapper; CSS via variables, sem inline color hex
7. **Tests:** Zod schemas em `_schemas/*.test.ts`, lógica pura em `_lib/`/`src/lib/`
8. **Validação final:** `npm test && npm run build`

---

*Última atualização: 2026-05-13. Para mudanças recentes ver `REVIEW.md`.*
