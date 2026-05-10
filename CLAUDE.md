# CLAUDE.md — JP App

## Visão geral

Assistente pessoal do Jorge (founder do STATE Innovation Center) com 7 módulos: Briefing matinal automatizado, Tasks (sync Google Tasks), Calendar (sync Google Calendar), Contatos (CRM pessoal), Notas (post-it / texto / áudio / link), News (RSS reader), Configurações. PWA mobile-first com identidade STATE forte.

## Stack final (não negociável)

```
Frontend:    Vite + React 19 + React Router DOM 7
Linguagem:   TypeScript em strict mode (desde commit 0)
Estilo:      CSS variables + CSS puro (sem Tailwind, sem shadcn)
Backend:     Funções serverless em /api/*.ts (Vercel)
Validação:   Zod (schemas em todo handler /api/*, schemas compartilhados em api/_schemas/)
Banco:       Supabase (PostgreSQL) — SQL puro, sem ORM
Storage:     Supabase Storage — bucket note-audio (criar no dashboard)
Tipos DB:    supabase gen types typescript → src/types/database.ts
Auth:        JWT próprio + cookie httpOnly + bcrypt
IA:          @anthropic-ai/sdk — Haiku para parsing/curadoria, Sonnet para raciocínio pesado
Email:       Resend
Cron:        Vercel Cron (vercel.json)
RSS:         rss-parser
IMAP:        imapflow
Google:      googleapis (Tasks, Calendar, People) — escopos: calendar, tasks, contacts, directory.readonly
Editor:      Tiptap (@tiptap/react + @tiptap/pm + @tiptap/starter-kit)
Estado:      Context API + hooks tipados
Drag&Drop:   @dnd-kit/core
Datas:       date-fns + date-fns-tz (timezone-aware)
```

## O que NÃO usar

- ❌ Next.js — usar Vite + serverless
- ❌ Prisma — usar Supabase client + tipos gerados
- ❌ Tailwind / shadcn/ui — identidade autoral, CSS variables do protótipo
- ❌ Supabase Auth — JWT próprio; OAuth Google é só para escopos de API
- ❌ localStorage para auth — cookie httpOnly obrigatório
- ❌ Chamar IA em sequência — Promise.all para chamadas paralelas
- ❌ `.catch()` no Supabase JS — usar `await + try/catch` ou `.then(null, fn)`
- ❌ Funções de IA sem `maxDuration` no vercel.json
- ❌ Estado global espalhado — centralizar em hooks
- ❌ Validar só no frontend — Zod no backend é obrigatório
- ❌ Commitar .env.local — nunca no git
- ❌ Strings duplicadas em JSX — extrair para variável antes do return (ex: `syncActions`)
- ❌ Props opcionais com valor undefined explícito — usar spread condicional com exactOptionalPropertyTypes

## TypeScript

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true
}
```

- `.ts` para lógica pura, `.tsx` para JSX. Vite com oxc não compila JSX em `.ts`
- Sem `any` salvo casos justificados com comentário inline
- Tipos compartilhados em `src/types/`: `database.ts` (gerado), `api.ts` (z.infer), `domain.ts`
- **exactOptionalPropertyTypes**: nunca `{ key: value | undefined }` — usar spread condicional: `...(val != null ? { key: val } : {})`
- Imports em `api/` obrigatoriamente com extensão `.js` (NodeNext module resolution)

## Zod nos handlers

Todo handler `/api/*.ts`:
1. Define schema Zod no topo
2. `safeParse(req.body)` — retorna 400 se inválido
3. Exporta `z.infer<typeof Schema>` como tipo

Schemas compartilhados em `api/_schemas/`.

## Padrões de código

### Topbar com ações complexas
Sempre extrair para variável antes do return:
```tsx
const actions = (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
    <button className="sync-status" ...>Sync</button>
    <ThemeToggle />
  </div>
)
// depois: <Topbar actions={actions} />
```

### Google write-back (best-effort)
Local save sempre sucede; push Google é try/catch:
```typescript
try {
  const googleCalId = calRes.data?.google_calendar_id
  if (!googleCalId) { console.warn('[save] no google_calendar_id', calendarId); return }
  await gcal.events.patch(...)
} catch (e) {
  console.error('[save] google push failed:', e instanceof Error ? e.message : e)
}
```

### Upsert Supabase
Requer UNIQUE CONSTRAINT (não partial index) como arbiter. Para merge semantics:
- Pass 1: `ignoreDuplicates: true` — insere novos com todos os campos
- Pass 2: sem ignoreDuplicates — atualiza existentes com subset de campos (preserva edições locais)

### Props opcionais com exactOptionalPropertyTypes
```tsx
// ❌ ERRADO
<EventPanel prefill={prefill} />  // prefill: T | undefined não é compatível com prefill?: T

// ✅ CORRETO
<EventPanel {...(prefill !== undefined ? { prefill } : {})} />
```

## Comandos

```bash
npm run dev          # servidor de desenvolvimento (Vite)
npm run build        # build de produção (tsc + vite build)
npm run preview      # testar build local
npm run db:types     # gerar src/types/database.ts via supabase CLI
npm run test         # rodar Vitest
vercel env pull      # baixar env vars do Vercel para .env.local
vercel dev           # servidor local com funções serverless
```

## Estrutura de pastas

```
jp-app/
├── api/                    # Backend serverless
│   ├── _supabase.ts        # Cliente singleton (service key)
│   ├── _middleware.ts      # requireAuth, requireAdmin
│   ├── _google.ts          # OAuth2 client + getAuthedClient
│   ├── _briefing.ts        # Lógica de geração do briefing
│   ├── _schemas/           # Schemas Zod compartilhados
│   │   ├── event.ts
│   │   └── note.ts         # NoteSaveSchema, NoteTagSaveSchema, NoteFolderSaveSchema
│   ├── auth-login.ts / auth-logout.ts / auth-me.ts
│   ├── briefing-*.ts       # Briefing (generate, cron, history)
│   ├── calendars-*.ts      # Calendar (list, sync, toggle)
│   ├── contacts-*.ts       # Contacts (list, save, sync, archive)
│   ├── events-*.ts         # Calendar events (list, save, delete, sync, parse)
│   ├── google-oauth.ts     # OAuth flow
│   ├── interactions-*.ts   # Contact interactions
│   ├── news-*.ts           # News (list, fetch, favorite, read)
│   ├── note-folders-*.ts   # Note folders (list, save, delete)
│   ├── note-tags-*.ts      # Note tags (list, save, delete)
│   ├── notes-*.ts          # Notes (list, save, delete, upload)
│   ├── projects-list.ts    # Projects
│   ├── sources-*.ts        # RSS sources (list, save, delete)
│   ├── tasks-*.ts          # Tasks (list, save, sync, archive)
│   └── tsconfig.json
├── src/
│   ├── main.tsx
│   ├── App.tsx             # Roteamento + AuthProvider (7 módulos)
│   ├── api.ts              # Wrapper fetch tipado
│   ├── pages/              # Uma página por rota
│   │   ├── BriefingPage.tsx
│   │   ├── CalendarPage.tsx
│   │   ├── ConfigPage.tsx
│   │   ├── ContactsPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── NewsPage.tsx
│   │   ├── NotesPage.tsx
│   │   └── TasksPage.tsx
│   ├── components/
│   │   ├── layout/         # Topbar, Subtabs, BottomNav
│   │   ├── briefing/
│   │   ├── calendar/       # AgendaView, WeekView, MonthView, EventPanel, CalendarPicker
│   │   ├── contacts/
│   │   ├── common/         # ThemeToggle, ErrorBoundary
│   │   ├── notes/          # NoteCard, NotePanel, NoteEditor, AudioRecorder, FolderTree, TagManager
│   │   ├── tasks/          # TodayView, KanbanView (Flow+Groups), ListView, TaskPanel, QuickAdd
│   │   └── news/           # (inline no NewsPage)
│   ├── hooks/
│   │   ├── AuthProvider.tsx
│   │   ├── useAuth.ts / useTheme.ts
│   │   ├── useCalendars.ts / useEvents.ts
│   │   ├── useContacts.ts
│   │   ├── useNews.ts
│   │   ├── useNoteFolders.ts / useNoteTags.ts / useNotes.ts
│   │   ├── useProjects.ts / useTasks.ts
│   │   └── useSources.ts
│   ├── lib/                # dates.ts, colors.ts
│   ├── types/
│   │   ├── database.ts     # gerado via supabase CLI
│   │   ├── api.ts          # tipos das respostas de API
│   │   └── domain.ts       # tipos de negócio (Task, Note, NewsItem, etc.)
│   └── styles/globals.css  # CSS variables + estilos globais (fonte da verdade)
├── supabase/migrations/
│   ├── 0001_initial.sql    # users, projects, contacts, tasks, sources, newsletters, briefings
│   ├── 0002_calendar.sql   # calendars, calendar_events
│   ├── 0003_calendar_events_unique.sql
│   ├── 0004_contacts_google_unique.sql
│   ├── 0005_contacts_unique_constraint.sql  # UNIQUE CONSTRAINT (não partial index)
│   ├── 0006_tasks_google_unique.sql
│   ├── 0007_sync_contacts_fn.sql            # obsoleto — função não usada
│   ├── 0008_notes.sql                       # note_folders, note_tags, notes, note_tag_map
│   └── 0009_news.sql                        # news_items
├── public/
├── vercel.json             # rewrites + functions maxDuration + crons
├── .env.example
└── CLAUDE.md
```

## Setup Supabase Storage

Criar bucket `note-audio` no dashboard Supabase:
1. Storage → New Bucket → nome: `note-audio`, Public: sim (para URLs públicas de áudio)
2. Ou via SQL: `insert into storage.buckets (id, name, public) values ('note-audio', 'note-audio', true);`

## Hierarquia de autoridade quando em dúvida

1. CLAUDE.md (este arquivo)
2. Stack → este arquivo seção "Stack final"
3. Visual → prototipo.html
4. Padrões → seção "Padrões de código"

Quando algo não estiver coberto, **pergunte antes de codar**.
