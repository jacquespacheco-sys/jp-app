# JP App — Briefing Consolidado

> **Documento único de contexto para o Claude Code.**
> Contém: orientação de stack, SPEC técnico atualizado (com TypeScript, Zod e módulo Calendar), Playbook arquitetural do STATE Superapp, e referência ao protótipo visual.

---

## 0. Como ler este documento

Este briefing é a **fonte da verdade** do projeto. A ordem de autoridade é:

1. **Decisão de stack** → seção 2 (Playbook ganha das sugestões iniciais do SPEC original)
2. **Identidade visual** → arquivo `protótipo.html` que acompanha este briefing
3. **Schema de banco e endpoints** → seção 4 deste documento
4. **Convenções de código** → seção 3 (Playbook adaptado para TypeScript)

Quando houver conflito, vale esta hierarquia. Quando algo não estiver coberto, **pergunte antes de codar**.

---

## 1. Visão do produto

### 1.1 O que é o JP App

Assistente pessoal do Jorge (founder do STATE Innovation Center) com **5 módulos**:

1. **Briefing** — relatório matinal automatizado às 06:30 BRT, com curadoria de notícias (RSS + newsletters) feita por Claude Haiku, agenda e tasks do dia, enviado por email e disponível no app.
2. **Tasks** — gestão de tarefas com sync bidirecional com Google Tasks. Views: Today, Kanban, Lista, Gantt. Quick-add com parser bilíngue.
3. **Calendar** — calendário inspirado no Fantastical, sincronizado com Google Calendar. Edição em tempo real (sync incremental). Linguagem natural bilíngue (PT/EN). Integrado com Tasks.
4. **Contatos** — CRM pessoal sincronizado com Google Contacts. Pipeline, follow-ups, relacionamentos.
5. **Configurações** — sources, newsletters, integrações, preferências.

### 1.2 Princípios de design

- **Mobile-first PWA** (Jorge usa principalmente no celular)
- **Identidade STATE forte**: Bebas Neue + Space Grotesk + Space Mono, accent verde-limão (`#a8ff00`), bordas finas, dark mode
- **Confirm dialog em toda ação destrutiva**
- **Sync bidirecional resiliente** com last-write-wins + log
- **Linguagem natural sempre que possível** (quick-add de tasks, eventos, contatos)

---

## 2. Stack final (não negociável)

```
Frontend:    Vite 8 + React 19 + React Router DOM 7
Linguagem:   TypeScript em strict mode (desde commit 0)
Estilo:      CSS variables + CSS modules (sem Tailwind, sem shadcn)
Backend:     Funções serverless em /api/*.ts (Vercel)
Validação:   Zod (schemas de input em todo handler /api/*)
Banco:       Supabase (PostgreSQL) — SQL puro, sem ORM
Tipos DB:    supabase gen types typescript → src/types/database.ts
Auth:        JWT próprio + cookie httpOnly + bcrypt (padrão STATE Superapp)
IA:          @anthropic-ai/sdk
             - Haiku: parser de linguagem natural (tasks, eventos), curadoria de briefing
             - Sonnet: onde precisar raciocínio mais pesado (raro)
Email:       Resend
Cron:        Vercel Cron (vercel.json)
RSS:         rss-parser
IMAP:        imapflow (newsletters)
Google:      googleapis (Tasks, Calendar, People)
Estado:      Context API + hooks tipados (useAuth, useTasks, useEvents, etc)
Drag&Drop:   @dnd-kit/core (acessível)
Datas:       date-fns (timezone-aware) + date-fns-tz
```

### 2.1 O que NÃO usar (anti-padrões aprendidos)

- ❌ **Next.js** — App Router adiciona magia (cache implícito, server components) que dificulta debug. Vite + serverless dá mais controle.
- ❌ **Prisma** — overhead em serverless, build pesado, camada extra entre você e o SQL. Use Supabase client + tipos gerados.
- ❌ **Tailwind / shadcn/ui** — identidade do JP App é autoral demais; customizar shadcn pesado vira dívida. CSS variables do protótipo são a fonte da verdade.
- ❌ **Supabase Auth** — já temos padrão JWT próprio funcionando no STATE Superapp, replicar dá mais controle. OAuth Google é só para escopos do Calendar/Tasks/Contacts, não para login.
- ❌ **localStorage para auth** — usar cookie httpOnly.
- ❌ **Chamar IA em sequência** — usar `Promise.all` para chamadas paralelas.
- ❌ **`.catch()` no Supabase JS** — `PostgrestFilterBuilder` não implementa; usar `await + try/catch` ou `.then(null, fn)`.
- ❌ **Funções de IA sem `maxDuration`** no `vercel.json` — timeout default é ~10s.
- ❌ **Estado global espalhado** — centralizar em hooks (`useAuth`, `useTasks`, `useEvents`).
- ❌ **Validar só no frontend** — Zod no backend é obrigatório.

---

## 3. Convenções de código

### 3.1 TypeScript

- **Strict mode obrigatório** no `tsconfig.json`:
  ```json
  {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
  ```
- **`.ts` para lógica, `.tsx` para JSX.** Vite 8 com oxc não compila JSX em `.ts`.
- **Sem `any`** salvo em casos justificados com comentário `// eslint-disable-next-line` explicando.
- **Tipos compartilhados** em `src/types/`:
  - `database.ts` — gerado por `supabase gen types typescript --project-id ... > src/types/database.ts`
  - `api.ts` — schemas Zod e seus `z.infer` correspondentes
  - `domain.ts` — tipos de domínio (Task, Event, Contact, etc) derivados dos schemas Zod onde fizer sentido

### 3.2 Zod nos handlers

Todo handler `/api/*.ts` segue o padrão:

```typescript
// api/tasks-save.ts
import { z } from 'zod'
import { getSupabase } from './_supabase'
import { requireAuth } from './_middleware'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const TaskSaveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  notes: z.string().default(''),
  status: z.enum(['inbox', 'next', 'doing', 'blocked', 'done']).default('inbox'),
  priority: z.enum(['high', 'med', 'low']).default('med'),
  projectId: z.string().uuid(),
  contactId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
})

export type TaskSaveInput = z.infer<typeof TaskSaveSchema>

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = requireAuth(req, res)
  if (!user) return
  if (req.method !== 'POST') return res.status(405).end()

  const parsed = TaskSaveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid input', issues: parsed.error.issues })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('tasks')
    .upsert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ task: data })
}
```

### 3.3 Estrutura de pastas

```
jp-app/
├── api/                                # Backend serverless
│   ├── _supabase.ts                    # Cliente singleton
│   ├── _middleware.ts                  # requireAuth, requireAdmin
│   ├── _schemas/                       # Schemas Zod compartilhados
│   │   ├── task.ts
│   │   ├── event.ts
│   │   ├── contact.ts
│   │   └── index.ts
│   ├── auth-login.ts
│   ├── auth-logout.ts
│   ├── auth-me.ts
│   ├── tasks-list.ts
│   ├── tasks-save.ts
│   ├── tasks-update.ts
│   ├── tasks-archive.ts
│   ├── projects-list.ts
│   ├── projects-save.ts
│   ├── events-list.ts                  # Calendar: lista eventos
│   ├── events-save.ts                  # Calendar: criar/editar
│   ├── events-delete.ts
│   ├── events-parse.ts                 # NLP via Haiku
│   ├── calendars-list.ts               # Lista sub-calendários
│   ├── calendars-toggle.ts             # On/off + cor
│   ├── contacts-list.ts
│   ├── contacts-save.ts
│   ├── interactions-save.ts
│   ├── sources-list.ts
│   ├── sources-save.ts
│   ├── newsletters-list.ts
│   ├── newsletters-save.ts
│   ├── briefing-generate.ts
│   ├── briefing-cron.ts                # Vercel Cron
│   ├── briefing-history.ts
│   ├── google-oauth.ts                 # OAuth flow Google
│   ├── sync-tasks.ts                   # Bidirecional Google Tasks
│   ├── sync-calendar.ts                # Incremental Google Calendar
│   ├── sync-contacts.ts                # Google People API
│   └── rss-preview.ts
│
├── src/
│   ├── main.tsx
│   ├── App.tsx                         # Roteamento + AuthProvider
│   ├── api.ts                          # Wrapper fetch tipado
│   │
│   ├── pages/
│   │   ├── BriefingPage.tsx
│   │   ├── TasksPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── ContactsPage.tsx
│   │   ├── ConfigPage.tsx
│   │   └── LoginPage.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Topbar.tsx
│   │   │   ├── BottomNav.tsx           # 5 itens: Briefing/Tasks/Calendar/Contacts/Config
│   │   │   └── Subtabs.tsx
│   │   ├── briefing/
│   │   │   ├── DashboardView.tsx
│   │   │   ├── EmailPreview.tsx
│   │   │   ├── Highlight.tsx
│   │   │   └── NewsItem.tsx
│   │   ├── tasks/
│   │   │   ├── TodayView.tsx
│   │   │   ├── KanbanView.tsx
│   │   │   ├── ListView.tsx
│   │   │   ├── GanttView.tsx
│   │   │   ├── ProjectsDashboard.tsx
│   │   │   ├── TaskRow.tsx
│   │   │   ├── TaskPanel.tsx
│   │   │   ├── QuickAdd.tsx
│   │   │   └── gantt/
│   │   │       ├── GanttBar.tsx
│   │   │       ├── GanttHeader.tsx
│   │   │       └── DependencyLines.tsx
│   │   ├── calendar/
│   │   │   ├── DayView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── MonthView.tsx
│   │   │   ├── AgendaView.tsx          # Lista
│   │   │   ├── EventBlock.tsx          # Bloco de evento numa view
│   │   │   ├── TaskPill.tsx            # Pílula de task com due no dia
│   │   │   ├── TimeBlockGhost.tsx      # Ghost do drag de task
│   │   │   ├── EventPanel.tsx          # Editor lateral
│   │   │   ├── QuickAddEvent.tsx       # Barra de NLP
│   │   │   ├── CalendarPicker.tsx      # Toggle de sub-calendários
│   │   │   └── ConflictBadge.tsx
│   │   ├── contacts/
│   │   │   ├── ContactsList.tsx
│   │   │   ├── PipelineView.tsx
│   │   │   ├── FollowupsView.tsx
│   │   │   ├── RelationshipsView.tsx
│   │   │   ├── ContactRow.tsx
│   │   │   ├── ContactPanel.tsx
│   │   │   ├── InteractionModal.tsx
│   │   │   └── BirthdaysStrip.tsx
│   │   └── common/
│   │       ├── ConfirmDialog.tsx
│   │       ├── ThemeToggle.tsx
│   │       └── SyncStatus.tsx
│   │
│   ├── hooks/
│   │   ├── AuthProvider.tsx
│   │   ├── useAuth.ts
│   │   ├── useTasks.ts
│   │   ├── useEvents.ts
│   │   ├── useCalendars.ts
│   │   ├── useContacts.ts
│   │   ├── useBriefing.ts
│   │   └── useTheme.ts
│   │
│   ├── lib/
│   │   ├── dates.ts                    # Wrappers tz-aware (date-fns-tz)
│   │   ├── nlp/
│   │   │   ├── parseTask.ts            # Local (regex) — fallback rápido
│   │   │   └── parseEvent.ts           # Chama /api/events-parse (Haiku)
│   │   └── colors.ts                   # Helpers de cor por calendário
│   │
│   ├── types/
│   │   ├── database.ts                 # Gerado: supabase gen types
│   │   ├── api.ts                      # z.infer dos schemas
│   │   └── domain.ts                   # Task, Event, Contact, etc
│   │
│   └── styles/
│       └── globals.css                 # CSS variables do protótipo
│
├── supabase/
│   └── migrations/
│       ├── 0001_initial.sql            # Schema completo (tabelas todas)
│       └── 0002_calendar.sql           # Eventos, calendários, time-blocks
│
├── public/
├── .env.example
├── .gitignore                          # .env.local OBRIGATÓRIO
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json                         # crons + maxDuration
└── README.md
```

### 3.4 Convenções de naming

- **Endpoints**: `verbo-substantivo` em kebab-case → `tasks-save.ts`, `events-parse.ts`, `briefing-generate.ts`
- **Componentes**: PascalCase, um por arquivo
- **Hooks**: prefixo `use`, camelCase
- **Tipos**: PascalCase
- **Tabelas SQL**: snake_case plural → `tasks`, `calendar_events`, `task_logs`
- **Colunas SQL**: snake_case → `user_id`, `created_at`, `google_event_id`

### 3.5 Convenções de commit

- `feat:` nova funcionalidade
- `fix:` correção
- `chore:` manutenção
- `refactor:` melhoria sem mudar comportamento
- Commitar com frequência (ao final de cada subtarefa do plano).

---

## 4. Schema do banco (SQL)

> Migration `supabase/migrations/0001_initial.sql` — execute no SQL Editor do Supabase ou via CLI.

```sql
-- =============================================================
-- USERS
-- =============================================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  city text,
  timezone text not null default 'America/Sao_Paulo',
  google_refresh_token text,             -- criptografado AES-256
  anthropic_api_key text,                -- criptografado AES-256
  theme text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================
-- PROJECTS
-- =============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text not null default '#a8ff00',
  google_task_list_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects(user_id);

-- =============================================================
-- TASKS
-- =============================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  notes text not null default '',
  status text not null default 'inbox',  -- inbox|next|doing|blocked|done
  priority text not null default 'med',  -- high|med|low
  tags text[] not null default '{}',
  due_date timestamptz,
  start_offset int,                      -- Gantt: dias do início
  duration int,                          -- Gantt: dias
  depends_on uuid[] not null default '{}',
  archived boolean not null default false,
  archived_at timestamptz,
  google_tasks_id text,
  synced boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks(user_id);
create index on public.tasks(project_id);
create index on public.tasks(status);
create index on public.tasks(due_date);

create table public.task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  changes jsonb not null,
  timestamp timestamptz not null default now()
);

-- =============================================================
-- CONTACTS
-- =============================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  company text,
  role text,
  email text,
  phone text,
  address text,
  birthday text,                         -- DD/MM
  tags text[] not null default '{}',
  phase text,                            -- prospect|first|talking|proposal|active|dormant
  next_contact text,
  notes text not null default '',
  google_contact_id text,
  synced boolean not null default false,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contacts(user_id);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  date timestamptz not null,
  type text not null,                    -- call|meeting|email|message
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  related_id uuid not null references public.contacts(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (contact_id, related_id)
);

create table public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  changes jsonb not null,
  timestamp timestamptz not null default now()
);

-- =============================================================
-- BRIEFING
-- =============================================================
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  url text not null,
  active boolean not null default true,
  last_fetch timestamptz,
  created_at timestamptz not null default now()
);

create table public.newsletters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  sender_email text not null,
  active boolean not null default true,
  last_fetch timestamptz,
  created_at timestamptz not null default now()
);

create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  highlight text not null,
  content jsonb not null,                -- { global, brasil, newsletters, agenda, tasks }
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  model text not null default 'claude-haiku-4-5-20251001',
  token_count int,
  cost numeric(10,4),
  created_at timestamptz not null default now()
);
create index on public.briefings(user_id, date);
```

> Migration `supabase/migrations/0002_calendar.sql` — schema do módulo Calendar.

```sql
-- =============================================================
-- CALENDARS (sub-calendários do Google + preferências do JP App)
-- =============================================================
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  google_calendar_id text not null,      -- ID no Google
  summary text not null,                 -- nome do calendário
  description text,
  google_color_id text,                  -- cor original do Google
  custom_color text,                     -- override do usuário no JP App
  is_primary boolean not null default false,
  is_visible boolean not null default true,
  is_default_for_create boolean not null default false,
  access_role text,                      -- owner|writer|reader
  sync_token text,                       -- para listChanges incremental
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_calendar_id)
);
create index on public.calendars(user_id);

-- =============================================================
-- CALENDAR_EVENTS (cache local + eventos criados no JP App)
-- =============================================================
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  google_event_id text,                  -- ID no Google (null se ainda não syncou)
  ical_uid text,                         -- estável entre recorrências
  summary text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text,                         -- TZ original do evento
  status text not null default 'confirmed',  -- confirmed|tentative|cancelled
  recurrence text[],                     -- RRULE strings (read-only no MVP)
  recurring_event_id text,               -- Se for instância de recorrência
  attendees jsonb,                       -- [{email, displayName, responseStatus}]
  organizer_email text,
  is_organizer boolean not null default true,
  source text not null default 'google', -- google|jp_app|task_block
  task_id uuid references public.tasks(id) on delete set null,  -- se for time-block
  synced boolean not null default false,
  etag text,                             -- para detecção de conflito
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.calendar_events(user_id);
create index on public.calendar_events(calendar_id);
create index on public.calendar_events(start_at);
create index on public.calendar_events(google_event_id);

create table public.event_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.calendar_events(id) on delete cascade,
  user_id uuid not null references public.users(id),
  action text not null,                  -- create|update|delete|conflict_resolved
  changes jsonb,
  source text not null,                  -- jp_app|google_sync
  timestamp timestamptz not null default now()
);
```

---

## 5. APIs internas

### 5.1 Convenções

- REST-ish via funções serverless `/api/*.ts`
- Autenticação via cookie httpOnly (JWT próprio)
- Response shape: `{ data, error }` — `data` em sucesso, `error` em falha
- **Todo handler valida `userId` da sessão antes de qualquer operação**
- **Todo handler valida o body com Zod antes de tocar no banco**

### 5.2 Endpoints — mapa completo

```
# AUTH
POST   /api/auth-login                  { email, password }
POST   /api/auth-logout
GET    /api/auth-me

# TASKS
GET    /api/tasks-list                  ?project=&status=&archived=
POST   /api/tasks-save                  (create + update via upsert)
POST   /api/tasks-archive               { id }
POST   /api/tasks-unarchive             { id }

# PROJECTS
GET    /api/projects-list
POST   /api/projects-save

# CALENDAR
GET    /api/calendars-list              ?onlyVisible=
POST   /api/calendars-toggle            { id, isVisible?, customColor?, isDefaultForCreate? }
GET    /api/events-list                 ?from=&to=&calendarIds=
POST   /api/events-save                 (create + update; sync com Google na hora)
POST   /api/events-delete               { id }
POST   /api/events-parse                { text, lang? } → JSON estruturado via Haiku

# CONTACTS
GET    /api/contacts-list               ?phase=&tag=
POST   /api/contacts-save
POST   /api/interactions-save

# BRIEFING
GET    /api/briefing-history
GET    /api/briefing-get                ?date=
POST   /api/briefing-generate           (gera agora, manual)
GET    /api/briefing-cron               (Vercel Cron, protegido por CRON_SECRET)

# SOURCES & NEWSLETTERS
GET    /api/sources-list
POST   /api/sources-save
GET    /api/newsletters-list
POST   /api/newsletters-save
GET    /api/rss-preview                 ?url=

# GOOGLE
GET    /api/google-oauth                ?action=auth|callback
POST   /api/sync-tasks
POST   /api/sync-calendar               (incremental via syncToken)
POST   /api/sync-contacts
GET    /api/sync-status
```

---

## 6. Módulo Calendar — especificação detalhada

### 6.1 Estratégia de sync com Google Calendar

**Sync incremental com `syncToken`** (não polling completo):

```
1. Primeira sync: events.list({calendarId, showDeleted: false, singleEvents: true})
   → guarda nextSyncToken na tabela calendars
2. Sync subsequente: events.list({calendarId, syncToken, showDeleted: true})
   → retorna SÓ o que mudou desde a última sync
   → se syncToken expirou (410 Gone), refazer full sync
3. Cron */2 * * * * chama /api/sync-calendar para todos os calendários visíveis
4. Mudanças locais (criar/editar/deletar) → PATCH/POST/DELETE na hora no Google
   → atualiza etag local após sucesso
   → marca synced=true
```

**Conflict resolution**: last-write-wins comparando `updated_at` local vs `updated` do Google. Conflito grava em `event_logs` com `action='conflict_resolved'`.

### 6.2 Linguagem natural via Claude Haiku

Endpoint `/api/events-parse`:

```typescript
// api/events-parse.ts
const ParseInputSchema = z.object({
  text: z.string().min(1).max(500),
  lang: z.enum(['pt', 'en', 'auto']).default('auto'),
})

const ParsedEventSchema = z.object({
  summary: z.string(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  location: z.string().nullable(),
  calendarHint: z.string().nullable(),    // se usuário usou prefixo como "#trabalho"
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().nullable(),
})
```

**Prompt do Haiku** (template):

```
Você é um parser de eventos de calendário bilíngue (PT/EN). Receba um texto e a data/hora atual e retorne JSON estruturado.

Data/hora atual: {NOW_ISO} ({TZ})
Calendários disponíveis: {CALENDAR_LIST}
Texto do usuário: "{TEXT}"

Regras:
- Se usuário usou prefixo "#nome", mapear para um calendário pelo nome
- Duração padrão: 1 hora se não especificado
- "amanhã" / "tomorrow" = D+1
- "próxima [dia]" / "next [day]" = próxima ocorrência
- "manhã" = 09:00, "tarde" = 14:00, "noite" = 19:00 (se não especificado)
- "morning" = 09:00, "afternoon" = 14:00, "evening" = 19:00
- All-day se data sem horário ("amanhã reunião com Pedro" → all_day=true)
- confidence='low' se ficou ambíguo

Retorne APENAS JSON, sem markdown, conforme schema:
{
  "summary": "...",
  "startAt": "ISO 8601 com TZ",
  "endAt": "ISO 8601 com TZ",
  "allDay": false,
  "location": null,
  "calendarHint": null,
  "confidence": "high",
  "notes": null
}
```

**Validação**: resposta passa por `ParsedEventSchema.safeParse` antes de chegar no frontend. Se confidence='low', UI mostra preview editável antes de criar.

### 6.3 Views do calendário

Inspiração: **Fantastical**. Identidade: **STATE** (tipografia + cores do protótipo).

- **Day**: agenda do dia com timeline (06:00 → 23:00 default), eventos como blocos, tasks com `dueDate=hoje` como pílulas no topo
- **Week**: 7 colunas, timeline lateral, scroll vertical
- **Month**: grid 7×6, eventos truncados, dot por calendário
- **Agenda (Lista)**: lista cronológica vertical, próximos 30 dias, agrupada por dia

**Views responsivas**: no mobile, "Week" vira "3 dias" automaticamente (>768px usa 7 colunas).

### 6.4 Integração Tasks ↔ Calendar

**(a) Read-only overlay**: tasks com `dueDate` aparecem como pílulas no calendário do JP App (não viram eventos no Google). Cor da pílula = cor do projeto.

**(c) Time-blocking**: arrastar uma task para um horário no calendário cria um evento `source='task_block'` no calendário padrão de criação, com `task_id` apontando para a task. Esse evento sync com Google normalmente. Editar o time-block no Google atualiza só o evento, não a task original.

**(b) NÃO implementado**: tasks viram eventos automaticamente. Sem duplicação automática.

### 6.5 Quick-add de eventos

Barra fixa no topo da CalendarPage:
- Placeholder bilíngue: "reunião amanhã 15h" / "lunch tomorrow noon"
- Enter dispara `/api/events-parse`
- Se confidence='high': cria direto e mostra toast com undo (5s)
- Se confidence='medium': abre EventPanel pré-preenchido
- Se confidence='low': abre EventPanel com aviso

### 6.6 Sub-calendários (multi-calendar)

- Lista todos os calendários da conta Google (incluindo compartilhados)
- Toggle on/off por calendário (visibilidade) — persiste em `calendars.is_visible`
- Cor: usa Google color por padrão; usuário pode override em `calendars.custom_color`
- Calendário padrão para criar: 1 marcado como `is_default_for_create=true`
- **JP App não cria nem deleta calendários** — só consome. Gerenciamento de calendários é no Google.

---

## 7. Pipeline do Briefing

### 7.1 Fluxo de geração

```
1. Vercel Cron dispara GET /api/briefing-cron às 09:30 UTC (06:30 BRT)
   Header: Authorization: Bearer ${CRON_SECRET}
2. Handler chama generateBriefing(userId):
   a. Promise.all:
      - Fetch RSS de todas as sources ativas → 40-80 artigos brutos
      - Fetch newsletters do email dedicado (IMAP) → 3-5 emails
      - Fetch próximos eventos do Google Calendar (hoje)
      - Fetch tasks do dia (due_date=hoje OU prioritárias)
   b. Chama Claude Haiku com prompt de curadoria + artigos brutos
      → retorna JSON validado por Zod: { highlight, global[], brasil[], newsletters[] }
   c. Persiste em briefings
   d. Envia email via Resend (template HTML)
   e. Marca email_sent=true
3. Retorna { ok: true, briefingId }
```

### 7.2 Prompt de curadoria (template)

```
Você é o curador do briefing matinal de {USER_NAME}, founder do STATE Innovation Center em São Paulo. Empreendedor, interessado em economia (Brasil e global), tecnologia, inovação, design, cultura, São Paulo.

Abaixo estão os artigos brutos das últimas 24h de cada fonte. Selecione os mais relevantes seguindo estas regras:

- Exatamente 1 "highlight" (o item mais importante do dia, 2-3 linhas)
- 4 itens em "global" (misto entre The Economist e The Guardian)
- 4 itens em "brasil" (misto entre Valor e Brazil Journal)
- 3 itens em "newsletters" (1 por newsletter, sintetizando o ponto principal)

Tom: direto, executivo, sem floreios. Cada resumo tem 2 linhas no máximo.

Retorne APENAS JSON válido, sem markdown, estrutura exata:
{
  "highlight": "...",
  "global": [{"source": "...", "title": "...", "summary": "...", "url": "..."}],
  "brasil": [...],
  "newsletters": [...]
}

=== ARTIGOS BRUTOS ===
{RAW_ARTICLES_BY_SOURCE}

=== NEWSLETTERS DO DIA ===
{RAW_NEWSLETTERS}
```

---

## 8. Integrações Google

### 8.1 OAuth setup

- Criar projeto no Google Cloud Console
- Habilitar APIs: **Tasks, Calendar, People**
- Criar OAuth 2.0 Client ID (tipo Web Application)
- Redirect URI: `https://jpapp.jorge.com/api/google-oauth?action=callback`
- Scopes:
  - `https://www.googleapis.com/auth/tasks`
  - `https://www.googleapis.com/auth/calendar` (leitura + escrita)
  - `https://www.googleapis.com/auth/contacts`
  - `openid email profile`

**Refresh token salvo no banco** criptografado com AES-256 (chave em `ENCRYPTION_KEY` env). Renovado automaticamente quando expira.

### 8.2 Sync Tasks (resumo)

- Bidirecional, last-write-wins
- Cron `*/5 * * * *` chama `listChanges` da Tasks API
- Mapping: Project ↔ TaskList; Task ↔ Task (status `done` ↔ `completed`)
- Campos JP-exclusivos (priority, tags, depends_on, start_offset, duration) persistem só localmente

### 8.3 Sync Calendar

Já documentado em 6.1.

### 8.4 Sync Contacts

- Mapping People API → contacts table
- Cron `*/30 * * * *`
- Bidirecional na criação; edição local sobrescreve Google em campos básicos

---

## 9. Variáveis de ambiente

```bash
# Auth
JWT_SECRET=                              # gerar: openssl rand -hex 32
ENCRYPTION_KEY=                          # AES-256, 32 bytes hex

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=                    # service_role (backend only)
SUPABASE_ANON_KEY=                       # anon (frontend)

# Anthropic
ANTHROPIC_API_KEY=

# Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=briefing@jpapp.jorge.com

# IMAP (newsletters)
IMAP_HOST=
IMAP_USER=
IMAP_PASSWORD=

# Cron
CRON_SECRET=                             # bearer token para proteger cron endpoints

# App
APP_URL=https://jpapp.jorge.com
```

---

## 10. vercel.json

```json
{
  "functions": {
    "api/briefing-generate.ts": { "maxDuration": 60 },
    "api/briefing-cron.ts": { "maxDuration": 60 },
    "api/events-parse.ts": { "maxDuration": 30 },
    "api/sync-tasks.ts": { "maxDuration": 60 },
    "api/sync-calendar.ts": { "maxDuration": 60 },
    "api/sync-contacts.ts": { "maxDuration": 60 }
  },
  "crons": [
    { "path": "/api/briefing-cron", "schedule": "30 9 * * *" },
    { "path": "/api/sync-tasks", "schedule": "*/5 * * * *" },
    { "path": "/api/sync-calendar", "schedule": "*/2 * * * *" },
    { "path": "/api/sync-contacts", "schedule": "*/30 * * * *" }
  ]
}
```

---

## 11. Plano de fases

### Fase 0 — Fundação
Setup, schema, auth, layout, 5 páginas placeholder, dark mode.

### Fase 1 — Tasks MVP
CRUD, parser quick-add, Today/Kanban/Lista, TaskPanel, ConfirmDialog.

### Fase 2 — Sync Google Tasks
OAuth, wrapper, sync bidirecional, SyncStatus pill.

### Fase 3 — Calendar MVP
Schema 0002, OAuth scopes, calendars-list, events-list, sync incremental, Day/Week/Month/Agenda views, EventPanel, sub-calendar picker.

### Fase 4 — Calendar avançado
Quick-add NLP via Haiku, time-blocking de tasks, undo toast, conflict resolution.

### Fase 5 — Briefing MVP
Sources/Newsletters CRUD, RSS, IMAP, geração com Haiku, email Resend, cron, DashboardView, EmailPreview.

### Fase 6 — Gantt + Projects Dashboard
GanttView custom, dependency lines SVG, ProjectsDashboard, log de edições.

### Fase 7 — Contatos MVP
CRUD, ContactsList, FollowupsView, ContactPanel, InteractionModal, sync People API.

### Fase 8 — Contatos avançado
Pipeline kanban, RelationshipsView, BirthdaysStrip no briefing, link Tasks ↔ Contacts.

### Fase 9 — Polimento + produção
PWA manifest, error boundaries, Sentry opcional, Vitest dos parsers/sync/briefing, smoke test em produção, README final.

---

## 12. Plano de testes

### 12.1 Crítico (Vitest unit + integration)

- Parser de quick-add task (regex local)
- Parser de evento NLP (mock do Haiku)
- Sync Google Tasks (criação, edição, conclusão)
- Sync Calendar incremental (syncToken expirado, eventos deletados)
- Geração do briefing (orquestração completa)
- Confirm dialog flows (não pular confirmação)

### 12.2 Importante

- RSS fetching com feeds reais mockados
- Email rendering
- OAuth flow completo

### 12.3 Nice to have (Playwright, opcional)

- Criar task → Kanban → drag pra done → desaparece do Today
- Criar evento via NLP → aparece no calendário → editar → deletar
- Drag task no calendário → cria time-block
- Gerar briefing → ver preview → receber email

### 12.4 Ferramentas

- **Vitest** — unit + integration
- **Testing Library** — component tests
- **MSW** — mock de APIs externas (Google, Anthropic, Resend)
- **Playwright** — E2E (opcional MVP)

---

## 13. Segurança

- Todas as chaves em Vercel env vars; nunca no código
- Tokens OAuth criptografados (AES-256) antes de persistir
- Refresh tokens renovados com exponential backoff
- Cookie httpOnly, secure, sameSite=strict
- Validação de input com Zod em **todo** handler
- Cron endpoints protegidos com `Authorization: Bearer ${CRON_SECRET}`
- Sem RLS porque usamos service key + JWT próprio + filtro `user_id` em toda query

---

## 14. Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Quota Google APIs | Alto | Backoff exponencial, queue local, sync incremental |
| Rate limit Anthropic | Médio | Fallback Haiku → Sonnet só se Haiku falhar |
| Parsing RSS irregular | Médio | rss-parser tolerante + fallback manual |
| IMAP delay | Baixo | Processar 48h na pior hipótese |
| Conflitos de sync | Médio | Last-write-wins + log para review |
| `syncToken` expirado | Baixo | Re-full-sync automático ao receber 410 |
| NLP do Haiku errar evento | Médio | Confidence score + preview editável |
| Custo escalando | Baixo | Uso pessoal, limites baixos |

---

## 15. Custos estimados (uso pessoal)

| Item | Custo/mês |
|---|---|
| Vercel Hobby | $0 |
| Supabase Free | $0 |
| Resend Free | $0 |
| Anthropic Haiku | ~$5-8 (briefing diário + parsing eventos) |
| Google APIs | $0 |
| Domínio | ~$1 |
| **Total** | **~$6-10/mês** |

---


---

# ANEXO A — Playbook arquitetural do STATE Superapp

> Este playbook é a **referência de padrões** que você (Claude Code) deve seguir.
> Ele documenta o que funcionou no STATE Superapp em produção.
> Onde houver tensão entre este playbook e o SPEC original, o playbook ganha — exceto pelas atualizações já incorporadas nas seções 1-15 acima (TypeScript, Zod, módulo Calendar).

# Playbook: Construção de Apps Web com Vercel + Supabase + React

> Manual de referência baseado na construção do STATE Superapp (abril 2026).
> Use como guia para novos projetos e para reforçar o que já foi aprendido.

---

## 1. A Stack e Por Que Cada Escolha

### Visão geral

```
USUÁRIO
  │
  ▼
VERCEL (hosting + backend serverless)
  ├── Frontend: React + Vite (arquivos estáticos)
  └── Backend: Funções Serverless (pasta /api)
        │
        ├── SUPABASE (banco de dados PostgreSQL)
        ├── VERCEL BLOB (armazenamento de arquivos)
        ├── RESEND (envio de e-mails)
        ├── ANTHROPIC (inteligência artificial)
        ├── PIPEDRIVE (CRM)
        └── GOOGLE CALENDAR (agenda)
```

### Por que cada tecnologia

| Tecnologia | Por quê |
|------------|---------|
| **React 19** | Padrão de mercado para interfaces dinâmicas. Grande ecossistema, componentes reutilizáveis. |
| **Vite 8** | Build ultrarrápido. Substitui o Create React App (obsoleto). Hot reload em milissegundos. |
| **React Router DOM 7** | Navegar entre páginas sem recarregar o browser (SPA - Single Page Application). |
| **Vercel** | Deploy em segundos com GitHub. Funções serverless sem servidor para gerenciar. Auto-HTTPS. Gratuito para começar. |
| **Supabase** | PostgreSQL gerenciado, sem instalar banco de dados. Tem painel visual, real-time, autenticação (usamos a nossa própria). Gratuito para começar. |
| **Vercel Blob** | Armazenamento de arquivos (fotos, PDFs) integrado ao Vercel. Mais simples que AWS S3. |
| **Resend** | API moderna para envio de e-mails transacionais. Mais simples que SendGrid, melhor entregabilidade que Nodemailer. |
| **Anthropic Claude** | IA para gerar propostas. API com modelos Sonnet (mais capaz) e Haiku (mais rápido/barato). |
| **JWT + cookie httpOnly** | Autenticação segura: o token fica num cookie que JavaScript não consegue ler (proteção contra XSS). |
| **TipTap 3** | Editor de texto rico (bold, listas, títulos) baseado em ProseMirror. Pronto para usar, sem reinventar. |

---

## 2. Estrutura de um Projeto

### Como o projeto está organizado

```
meu-app/
├── api/                    ← Backend (funções serverless Vercel)
│   ├── _middleware.js      ← Autenticação compartilhada
│   ├── _supabase.js        ← Cliente do banco (singleton)
│   └── minha-rota.js       ← Cada arquivo = uma rota HTTP
│
├── src/                    ← Frontend (React)
│   ├── main.jsx            ← Ponto de entrada (monta o App no HTML)
│   ├── App.jsx             ← Roteamento principal
│   ├── api.js              ← Wrapper para chamar o backend
│   ├── index.css           ← Variáveis CSS + estilos globais
│   │
│   ├── pages/              ← Páginas completas (uma por rota)
│   ├── components/         ← Componentes reutilizáveis
│   └── hooks/              ← Lógica compartilhada (useAuth, etc.)
│
├── public/                 ← Arquivos estáticos (logo, fontes, favicon)
├── vercel.json             ← Configuração do Vercel (crons, timeouts)
├── vite.config.js          ← Configuração do Vite
├── package.json            ← Dependências
└── .env.example            ← Template das variáveis de ambiente
```

### Regra crítica: arquivos `.js` vs `.jsx`

O Vite 8 usa o compilador **oxc** por padrão, que **não processa JSX em arquivos `.js`**.

- **Arquivo com JSX (HTML dentro do JS) → extensão `.jsx`**
- **Arquivo só com lógica, sem JSX → extensão `.js`**

```
useAuth.js       ✅  (hook, sem JSX)
AuthProvider.jsx ✅  (tem <AuthProvider> em JSX)
useAuth.jsx      ❌  (extensão errada para arquivo sem JSX)
AuthProvider.js  ❌  (vai quebrar no build)
```

---

## 3. Configuração Inicial de um Novo Projeto

### Passo 1: Criar o projeto React

```bash
# Criar projeto com Vite
npm create vite@latest nome-do-app -- --template react

cd nome-do-app
npm install

# Instalar dependências essenciais
npm install react-router-dom
npm install @supabase/supabase-js
npm install bcryptjs jsonwebtoken
```

### Passo 2: Criar repositório no GitHub

```bash
# No terminal, dentro da pasta do projeto
git init
git add .
git commit -m "initial commit"

# Criar repo no GitHub (pelo site ou CLI)
gh repo create nome-do-app --public
git remote add origin https://github.com/seu-usuario/nome-do-app.git
git push -u origin master
```

### Passo 3: Conectar ao Vercel

```bash
# Instalar Vercel CLI (fazer uma vez só)
npm install -g vercel

# Dentro da pasta do projeto, fazer login
vercel login

# Linkar o projeto local com o Vercel
vercel link

# Puxar as variáveis de ambiente do Vercel para o .env local
vercel env pull .env.local
```

> **Importante:** `vercel link` cria uma pasta `.vercel/` com o ID do projeto. Se você já tiver um projeto criado no Vercel com outro nome, use `vercel link --project nome-do-projeto-no-vercel`.

### Passo 4: Configurar o Supabase

1. Acessar [supabase.com](https://supabase.com) → New Project
2. Criar o banco de dados
3. Em Settings → API: copiar `Project URL` e as duas chaves (`anon` e `service_role`)
4. Criar o arquivo `api/_supabase.js`:

```js
// api/_supabase.js
import { createClient } from '@supabase/supabase-js'

let _client = null

export function getSupabase() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY  // service key no backend (acesso total)
    )
  }
  return _client
}
```

> **Service key vs Anon key:**
> - **Service key:** uso exclusivo no backend (funções serverless). Bypassa Row Level Security. Nunca exponha no frontend.
> - **Anon key:** pode ser usada no frontend, respeita as políticas RLS do Supabase.
> - No nosso app: usamos service key no backend e fazemos nossa própria autenticação por JWT.

---

## 4. Variáveis de Ambiente

### Conceito fundamental

Variáveis de ambiente guardam segredos (chaves de API, senhas) **fora do código**. Nunca commitar segredos no Git.

### Onde ficam

| Local | Arquivo | Uso |
|-------|---------|-----|
| Desenvolvimento local | `.env.local` | Só na sua máquina, nunca no Git |
| Produção Vercel | Dashboard Vercel ou CLI | Injetadas automaticamente no build |

### Adicionar variável no Vercel (CLI)

```bash
# Adicionar para todos os ambientes (production + preview + development)
vercel env add NOME_DA_VARIAVEL

# Adicionar só para produção
vercel env add NOME_DA_VARIAVEL production

# Adicionar para preview com branch específico
vercel env add NOME_DA_VARIAVEL preview master --value "valor" --yes

# Listar todas as variáveis
vercel env ls

# Remover uma variável
vercel env rm NOME_DA_VARIAVEL
```

### Puxar variáveis do Vercel para uso local

```bash
vercel env pull .env.local
```

### Variáveis típicas de um projeto

```bash
# Autenticação
JWT_SECRET=string_aleatoria_longa_minimo_32_chars

# Banco de dados (Supabase)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # service_role key
SUPABASE_ANON_KEY=eyJ...     # anon key

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# E-mail
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@seudominio.com

# IA
ANTHROPIC_API_KEY=sk-ant-...

# App
APP_URL=https://seuapp.vercel.app
```

---

## 5. Funções Serverless (Backend)

### Como funciona

Cada arquivo em `api/` vira uma rota HTTP automaticamente no Vercel.

```
api/auth-login.js   →  POST https://seuapp.com/api/auth-login
api/users-list.js   →  GET  https://seuapp.com/api/users-list
api/tasks-save.js   →  POST https://seuapp.com/api/tasks-save
```

### Estrutura básica de uma função

```js
// api/minha-rota.js
import { getSupabase } from './_supabase.js'
import { requireAuth } from './_middleware.js'

export default async function handler(req, res) {
  // 1. Verificar autenticação
  const user = requireAuth(req, res)
  if (!user) return  // requireAuth já respondeu com 401

  // 2. Só aceitar método correto
  if (req.method !== 'POST') return res.status(405).end()

  // 3. Ler dados do body
  const { nome, email } = req.body

  // 4. Validar dados
  if (!nome) return res.status(400).json({ error: 'nome obrigatório' })

  // 5. Interagir com banco
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('minha_tabela')
    .insert({ nome, email })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // 6. Retornar resultado
  return res.status(200).json({ item: data })
}
```

### Funções com tempo longo (IA, processamento)

Por padrão, funções Vercel têm timeout de ~10s. Para IA ou operações longas:

```json
// vercel.json
{
  "functions": {
    "api/claude.js": { "maxDuration": 60 }
  }
}
```

### Cron Jobs

Tarefas automáticas configuradas no `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/minha-tarefa",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Formato cron: `minuto hora dia-mes mes dia-semana`
- `*/20 * * * *` → a cada 20 minutos
- `0 3 1 * *` → dia 1 de cada mês às 3h
- `0 9 * * 1-5` → dias úteis às 9h

Para proteger o endpoint de chamadas externas:
```js
if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
  return res.status(401).end()
}
```

---

## 6. Autenticação com JWT

### Por que JWT + cookie httpOnly

- **JWT (JSON Web Token):** token assinado que prova quem é o usuário. O backend valida a assinatura sem consultar banco.
- **Cookie httpOnly:** JavaScript do browser não consegue ler. Protege contra ataques XSS que roubam tokens do localStorage.
- **SameSite=Strict:** cookie só é enviado para o mesmo domínio. Protege contra CSRF.

### Fluxo completo

```
1. POST /api/auth-login { email, senha }
   → backend valida bcrypt(senha, hash_no_banco)
   → gera JWT: jwt.sign({ id, email, role }, JWT_SECRET, { expiresIn: '7d' })
   → Set-Cookie: token=eyJ...; HttpOnly; Secure; SameSite=Strict; Path=/

2. Todas as rotas protegidas:
   → lê cookie: req.cookies.token
   → verifica: jwt.verify(token, JWT_SECRET)
   → retorna payload do usuário ou 401

3. Frontend:
   → GET /api/auth-me (cookie é enviado automaticamente)
   → guarda usuário em contexto React (AuthProvider)
   → toda requisição subsequente usa o cookie automaticamente
```

### Implementação do middleware

```js
// api/_middleware.js
import jwt from 'jsonwebtoken'
import { parse } from 'cookie'

export function requireAuth(req, res) {
  try {
    const cookies = parse(req.headers.cookie || '')
    const token = cookies.token
    if (!token) { res.status(401).json({ error: 'não autenticado' }); return null }
    const user = jwt.verify(token, process.env.JWT_SECRET)
    return user
  } catch {
    res.status(401).json({ error: 'token inválido' }); return null
  }
}

export function requireAdmin(req, res) {
  const user = requireAuth(req, res)
  if (!user) return null
  if (user.role !== 'admin' && user.role !== 'staff') {
    res.status(403).json({ error: 'sem permissão' }); return null
  }
  return user
}
```

---

## 7. Banco de Dados (Supabase / PostgreSQL)

### Boas práticas de schema

**Use UUIDs como PK** (não inteiros sequenciais expostos):
```sql
id uuid DEFAULT gen_random_uuid() PRIMARY KEY
```

**Timestamps automáticos:**
```sql
criado_em timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

**JSONB para dados flexíveis:**
```sql
-- Permite adicionar campos sem alterar a tabela
data jsonb
-- Exemplo: briefs guardam todos os campos do evento em data: jsonb
```

### Consultas com Supabase JS v2 — armadilha importante

**`PostgrestFilterBuilder` não implementa `.catch()`.**

```js
// ❌ ERRADO — vai lançar TypeError: .catch is not a function
supabase.from('tabela').insert({}).catch(() => {})

// ✅ CORRETO — usar .then(null, handler) para ignorar erro
supabase.from('tabela').insert({}).then(null, () => {})

// ✅ CORRETO — usar await com try/catch
try {
  const { data, error } = await supabase.from('tabela').insert({}).select().single()
} catch (e) { ... }
```

### FK ambígua no PostgREST (Supabase)

Se uma tabela tem **duas chaves estrangeiras para a mesma tabela**, o PostgREST não sabe qual usar no join automático.

```js
// ❌ Vai retornar erro "could not embed because more than one relationship"
supabase.from('bookings').select('*, users(*)')

// ✅ Especificar qual FK usar pelo nome da constraint
supabase.from('bookings').select('*, users!bookings_user_id_fkey(*)')
```

---

## 8. Frontend: Padrões React

### API wrapper centralizado

```js
// src/api.js
const BASE = ''  // mesmo domínio

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // envia cookie automaticamente
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + path, opts)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path, body)  => request('DELETE', path, body),
}
```

Uso:
```js
const data = await api.post('/api/tasks-save', { title: 'Minha tarefa' })
```

### Context para estado global

Use Context API do React para estado compartilhado entre muitos componentes:

```js
// src/hooks/AuthProvider.jsx
import { createContext, useState, useEffect } from 'react'
import { api } from '../api.js'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/auth-me')
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
```

```js
// src/hooks/useAuth.js  (sem JSX, extensão .js)
import { useContext } from 'react'
import { AuthContext } from './AuthProvider.jsx'

export function useAuth() {
  return useContext(AuthContext)
}
```

### Carregamento paralelo de dados

Em vez de aguardar uma requisição para iniciar a próxima:

```js
// ❌ Sequencial (mais lento)
const users  = await api.get('/api/users-list')
const tasks  = await api.get('/api/tasks-list')
const areas  = await api.get('/api/areas-list')

// ✅ Paralelo (3x mais rápido)
const [users, tasks, areas] = await Promise.all([
  api.get('/api/users-list'),
  api.get('/api/tasks-list'),
  api.get('/api/areas-list'),
])

// ✅ Paralelo sem falhar se um erro (Promise.allSettled)
const results = await Promise.allSettled([...])
results.forEach(r => { if (r.status === 'fulfilled') { /* usar r.value */ } })
```

### Roteamento e proteção de rotas

```jsx
// src/App.jsx
function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Carregando…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin' && user.role !== 'staff') return <Navigate to="/portal" replace />
  return children
}

// Uso:
<Route path="/admin/*" element={
  <AdminRoute>
    <Admin />
  </AdminRoute>
} />
```

---

## 9. Deploy e Fluxo de Trabalho

### Deploy automático (GitHub → Vercel)

1. Vercel fica "ouvindo" o repositório GitHub
2. Qualquer `git push` para `master` dispara um novo build automaticamente
3. Em ~30 segundos o app está atualizado em produção

```bash
# Workflow diário
git add src/components/MeuComponente.jsx
git commit -m "feat: adiciona componente de busca"
git push  # → deploy automático no Vercel
```

### Deploy manual (quando necessário)

```bash
# Dentro da pasta do projeto
npx vercel --prod
```

Use quando:
- O auto-deploy falhou e precisa reforçar
- Quer testar em produção antes de commitar

### Preview deploys

Cada branch ou PR no GitHub gera uma URL de preview no Vercel:
```
https://meu-app-git-feat-nova-funcao.vercel.app
```

Útil para testar antes de fazer merge para master.

### Verificar logs de uma função no Vercel

```bash
vercel logs https://meu-app.vercel.app/api/minha-rota
```

---

## 10. Comandos de Terminal — Referência Rápida

### Git

```bash
git status                        # ver o que mudou
git diff                          # ver as mudanças linha por linha
git add arquivo.jsx               # adicionar arquivo específico ao staging
git add -A                        # adicionar tudo (cuidado com .env!)
git commit -m "feat: descrição"   # criar commit
git push                          # enviar para GitHub (e disparar deploy)
git log --oneline                 # ver histórico resumido
git checkout -b nova-feature      # criar e mudar para nova branch
git merge nome-da-branch          # fazer merge de uma branch
```

### Vercel CLI

```bash
vercel login                      # fazer login
vercel link                       # linkar pasta ao projeto Vercel
vercel link --project nome        # linkar a projeto específico
vercel env ls                     # listar variáveis de ambiente
vercel env add NOME               # adicionar variável (interativo)
vercel env rm NOME                # remover variável
vercel env pull .env.local        # baixar variáveis para uso local
vercel --prod                     # deploy manual para produção
vercel logs URL                   # ver logs de uma função
vercel inspect URL                # inspecionar deployment
```

### npm / Node

```bash
npm install                       # instalar dependências do package.json
npm install nome-pacote           # instalar e adicionar ao package.json
npm install -D nome-pacote        # instalar como dependência de dev
npm run dev                       # rodar servidor de desenvolvimento local
npm run build                     # gerar build de produção
npm run preview                   # testar build localmente
```

---

## 11. Diagrama de Arquitetura

```
╔══════════════════════════════════════════════════════════════════╗
║                         USUÁRIOS                                  ║
║   Admin/Staff           Cliente                  Público          ║
║   /admin/*              /reservas/*              /form            ║
╚══════════════╤══════════════════╤════════════════╤═══════════════╝
               │                  │                │
               ▼                  ▼                ▼
╔══════════════════════════════════════════════════════════════════╗
║                    VERCEL (CDN Global)                            ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │              FRONTEND (React + Vite)                     │   ║
║   │                                                          │   ║
║   │  App.jsx → roteamento → páginas → componentes            │   ║
║   │                                                          │   ║
║   │  Módulos:  Eventos │ Reservas │ Tarefas │ Portal         │   ║
║   │  Nav:      TopNav (horizontal, scroll-hide)              │   ║
║   │  Auth:     cookie httpOnly → useAuth hook                │   ║
║   └──────────────────────┬──────────────────────────────────┘   ║
║                          │ fetch() com credentials: 'include'     ║
║   ┌──────────────────────▼──────────────────────────────────┐   ║
║   │         BACKEND (Vercel Serverless Functions /api)       │   ║
║   │                                                          │   ║
║   │  _middleware.js ← requireAuth / requireAdmin             │   ║
║   │  _supabase.js   ← cliente singleton                      │   ║
║   │                                                          │   ║
║   │  Rotas: auth-* │ briefs-* │ tasks-* │ bookings-* │ ...   │   ║
║   └──┬──────────┬──────────┬────────┬────────┬─────────────┘   ║
║      │          │          │        │        │                    ║
╚══════╪══════════╪══════════╪════════╪════════╪════════════════════╝
       │          │          │        │        │
       ▼          ▼          ▼        ▼        ▼
  ┌─────────┐ ┌───────┐ ┌──────┐ ┌──────┐ ┌───────────┐
  │SUPABASE │ │VERCEL │ │RESEND│ │CLAUDE│ │ PIPEDRIVE │
  │         │ │ BLOB  │ │      │ │  AI  │ │  GOOGLE   │
  │PostgreSQL│ │Arquivos│ │E-mail│ │Haiku │ │ CALENDAR  │
  │  tabelas │ │fotos  │ │      │ │Sonnet│ │           │
  └─────────┘ └───────┘ └──────┘ └──────┘ └───────────┘
```

### Fluxo de uma requisição típica

```
1. Usuário clica em "+ Tarefa" no browser
                │
                ▼
2. React executa handleSave(task)
   → api.post('/api/tasks-save', dadosDaTarefa)
   → fetch('/api/tasks-save', { method:'POST', body: JSON, credentials:'include' })
                │
                ▼ (cookie JWT é enviado automaticamente)
3. Vercel Serverless Function recebe a requisição
   → _middleware.requireAdmin(req, res) verifica JWT do cookie
   → se inválido: retorna 401 e para
   → se válido: continua com dados do usuário
                │
                ▼
4. Função lê req.body, valida campos
                │
                ▼
5. getSupabase().from('tasks').insert({...}).select().single()
   → Supabase executa SQL no PostgreSQL gerenciado
   → retorna { data, error }
                │
                ▼
6. Função retorna res.status(200).json({ task: data })
                │
                ▼
7. React recebe resposta, atualiza estado local
   → setTasks(prev => [...prev, novaTarefa])
   → Interface atualiza sem recarregar a página
```

### Fluxo de autenticação

```
Login:
  browser → POST /api/auth-login { email, senha }
          → bcrypt.compare(senha, hash) 
          → jwt.sign(payload, JWT_SECRET, '7d')
          → Set-Cookie: token=eyJ...; HttpOnly
          ← { user: {...} }

Requests subsequentes:
  browser → qualquer /api/rota-protegida
            [cookie enviado automaticamente pelo browser]
          → _middleware lê cookie
          → jwt.verify(token, JWT_SECRET)
          → retorna payload: { id, email, role }
          → função continua normalmente

Logout:
  browser → POST /api/auth-logout
          → Set-Cookie: token=; Max-Age=0
          ← { ok: true }
          → browser redireciona para /login
```

---

## 12. Integração com IA (Anthropic Claude)

### Estratégia: chamadas em paralelo

```js
// api/claude.js
const [itemsResult, textoResult] = await Promise.all([
  anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: promptItens }]
  }),
  anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',  // mais rápido para texto
    max_tokens: 1500,
    messages: [{ role: 'user', content: promptTexto }]
  })
])
```

**Por que modelos diferentes?**
- **Sonnet** (mais capaz): para raciocínio complexo, estruturar itens/preços
- **Haiku** (mais rápido e barato): para texto narrativo mais simples

### Proteção contra sobrescrever edições manuais

```js
// Antes de gerar com IA, verificar se o usuário já editou
if (conteudoAtual.length > 7) {
  const confirma = window.confirm('Já existe conteúdo. Substituir com IA?')
  if (!confirma) return
}
```

---

## 13. Notificações no App

### Sistema implementado

1. Backend cria linha em `notifications` ao salvar evento relevante
2. Frontend polling a cada 60s via `setInterval` no hook `useNotifications`
3. Badge no sino mostra contagem de não lidas
4. Clique na notificação: abre o item correspondente (brief, reserva)

### Dropdown com `position: fixed`

Se um elemento pai tem `position: fixed` (como o TopNav), um dropdown filho com `position: absolute` fica "preso" dentro desse contexto. Solução:

```jsx
// Calcular posição absoluta na tela com getBoundingClientRect()
const [dropPos, setDropPos] = useState(null)

function handleClick() {
  const rect = buttonRef.current.getBoundingClientRect()
  setDropPos({ top: rect.bottom, right: window.innerWidth - rect.right })
}

// Dropdown com position: fixed usa coordenadas da tela, não do pai
<div style={{
  position: 'fixed',
  top: dropPos.top,
  right: dropPos.right,
  zIndex: 1000,
}}>
  {/* conteúdo do dropdown */}
</div>
```

---

## 14. E-mail com Resend

```js
// api/send-email.js
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: `STATE <${process.env.FROM_EMAIL}>`,
  to: destinatario,
  subject: 'Assunto do e-mail',
  html: `<h1>Conteúdo</h1><p>Corpo do e-mail em HTML</p>`
})
```

**Por que Resend?**
- API simples (uma linha para enviar)
- Boa entregabilidade (chega no inbox, não no spam)
- Painel limpo para ver e-mails enviados
- Plano gratuito generoso (3.000 e-mails/mês)

---

## 15. Google Calendar OAuth

### Fluxo completo

```
1. Admin clica "Conectar Google Calendar"
2. Frontend redireciona para /api/calendar-oauth?action=auth
3. Backend redireciona para Google OAuth consent screen
4. Usuário autoriza → Google redireciona para /api/calendar-oauth?code=...
5. Backend troca o code pelo access_token + refresh_token
6. refresh_token salvo no banco (app_settings)
7. Para criar eventos: usa refresh_token para obter access_token fresco
```

**Por que salvar refresh_token no banco e não em variável de ambiente?**
- O refresh_token pode ser revogado e renovado pelo usuário
- Variáveis de ambiente são estáticas (precisaria de redeploy para atualizar)
- Banco é dinâmico: atualiza sem redeploy

---

## 16. Boas Práticas e Lições Aprendidas

### O que fazer

- **Componentizar desde o início.** Um componente = uma responsabilidade clara.
- **Centralizar chamadas à API** num único `api.js`. Facilita trocar a URL base ou adicionar autenticação global.
- **Manter estado no componente mais alto** que precisa dele. Não duplicar estado.
- **Usar `Promise.allSettled`** quando carregando múltiplas fontes e o app deve funcionar parcialmente se uma falhar.
- **Validar no backend sempre.** O frontend pode ser manipulado por qualquer pessoa.
- **Nomes descritivos de rotas:** `/api/tasks-save`, `/api/bookings-create` (verbo + substantivo, não genérico).
- **Commitar frequentemente** com mensagens descritivas:
  - `feat:` nova funcionalidade
  - `fix:` correção de bug
  - `chore:` manutenção (deletar arquivos, atualizar dependências)
  - `refactor:` melhorias de código sem mudar comportamento

### O que NÃO fazer

- **❌ Guardar segredos no Git.** Nunca commitar `.env` com chaves reais.
- **❌ Chamar IA em sequência.** Usar `Promise.all` para chamadas paralelas.
- **❌ Autenticação via localStorage.** Usar cookie httpOnly (mais seguro).
- **❌ Chamar o banco diretamente do frontend.** Sempre passar pelo backend.
- **❌ Usar Vercel KV como banco principal.** É key-value simples, não relacional. Use Supabase para dados relacionais.
- **❌ Clonar DOM para imprimir.** Usar `editor.getHTML()` ou CSS de impressão.
- **❌ `supabase.from(...).catch()`** — usar `.then(null, () => {})`.
- **❌ Funções de IA sem `maxDuration`** no `vercel.json` — timeout de ~10s.
- **❌ Estado global espalhado** — centralizar em hooks (`useAuth`, `useBriefs`).

---

## 17. Checklist para um Novo Projeto

```
Setup inicial:
[ ] npm create vite@latest + instalar dependências
[ ] Criar repositório GitHub + git push inicial
[ ] vercel link (conectar ao projeto Vercel)
[ ] Criar projeto no Supabase + criar tabelas
[ ] Configurar variáveis de ambiente no Vercel
[ ] vercel env pull .env.local

Estrutura base:
[ ] api/_supabase.js (cliente singleton)
[ ] api/_middleware.js (requireAuth)
[ ] api/auth-login.js, auth-logout.js, auth-me.js
[ ] src/api.js (wrapper fetch)
[ ] src/hooks/useAuth.js + AuthProvider.jsx
[ ] src/App.jsx com roteamento + proteção de rotas
[ ] src/index.css com variáveis CSS do design system

Antes do primeiro deploy:
[ ] Verificar que .env.local não está no Git (.gitignore)
[ ] Testar login + logout
[ ] Testar criação de dado básico
[ ] npm run build (sem erros)

Manutenção contínua:
[ ] git push (auto-deploy) após cada conjunto de mudanças
[ ] Verificar logs no Vercel se algo quebrar
[ ] vercel env add quando adicionar nova integração
```

---

*Documento gerado em abril 2026. Baseado na construção do STATE Superapp.*
*Projeto em produção: https://app.state.is*
