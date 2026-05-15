# CLAUDE.md — JP App

> Operacional do dia-a-dia. Para visão completa de módulos, schema, endpoints e integrações ver **[SPEC.md](./SPEC.md)** (espinha do app). Para débitos técnicos abertos ver **[REVIEW.md](./REVIEW.md)**.

## Visão (1 parágrafo)

Assistente pessoal do Jorge (founder do STATE Innovation Center). PWA mobile-first com identidade STATE. **AQAL** como espinha (4 quadrantes I/IT/WE/ITS), **GTD** como engine operacional (capture → process → engage), **Coach** como sócio sênior (Sonnet streaming + memória aprovada), **Briefing matinal** automatizado por email. 15 módulos, 84+ endpoints, 13 migrations, ~140 testes.

## Antes de criar feature nova

1. Leia **SPEC.md §3** (mapa de módulos) — o conceito já existe?
2. Leia **SPEC.md §6** (Reusar antes de criar) — checklist do que reaproveitar
3. Leia **SPEC.md §4** (Como módulos conversam) — sua feature integra com o quê?

## Stack final (não negociável)

```
Frontend:    Vite 6 + React 19 + React Router DOM 7
Linguagem:   TypeScript strict (noUncheckedIndexedAccess, exactOptionalPropertyTypes)
Estilo:      CSS variables + CSS puro (sem Tailwind/shadcn) — paleta Seda
Tipografia:  Fraunces (display) + General Sans (UI) + JetBrains Mono (labels)
Backend:     Funções serverless em api/*.ts (Vercel, NodeNext, ESM)
Validação:   Zod em todo handler (schemas em api/_schemas/)
Banco:       Supabase PostgreSQL — SQL puro, sem ORM
Tipos DB:    supabase gen types typescript → src/types/database.ts
Auth:        JWT próprio + cookie httpOnly + bcrypt (sem Supabase Auth)
IA:          @anthropic-ai/sdk — Haiku 4.5 (parsing/classificação), Sonnet 4.6 (chat/escrita)
Streaming:   SSE para chat do coach
Email:       Resend · RSS: rss-parser · IMAP: imapflow (não impl.)
Google:      googleapis (Tasks/Calendar/People)
Editor:      Tiptap (StarterKit)
Estado:      Context API + hooks tipados (AuthProvider, CoachProvider canônicos)
Drag&Drop:   @dnd-kit/core · Datas: date-fns + date-fns-tz
```

## Anti-padrões (lista negra)

| ❌ | ✅ |
|---|---|
| `new Anthropic({apiKey})` ad-hoc | `getAnthropic()` de `_anthropic.ts` |
| `raw.match(/\{[\s\S]*\}/) + JSON.parse` | `parseJsonFromLlm<T>(raw)` |
| `str.replace(/</g, '&lt;')` em email | `htmlEscape(str)` |
| `key: value ?? undefined` em literal | `...(value != null ? { key: value } : {})` |
| Hook stateful em N componentes | Provider único + hook consumer (modelo `CoachProvider`) |
| Refetch lista após mutação pra pegar IDs | Retornar IDs no response + setState in-place |
| `supabase.from(...).catch(fn)` | `await + try/catch` ou `.then(null, fn)` |
| Sequential `await` em N fontes independentes | `Promise.all([...])` |
| Função de IA sem `maxDuration` no vercel.json | Sempre setar (chat=60, briefing/cron=300) |
| `localStorage` para auth token | Cookie httpOnly via `Set-Cookie` |
| Validar só no frontend | Zod no backend obrigatório |
| Calcular `resolved_quadrant` no app | `v_tasks_resolved` |
| Push pra Google bloqueando o save | Local-first + try/catch best-effort |
| Comentário "// Step 1:" / "// Insere" | Sem comentário (nome diz o quê; comentário é só pro porquê) |

## TypeScript strict

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "exactOptionalPropertyTypes": true
}
```

- `.ts` para lógica, `.tsx` para JSX. Vite com oxc não compila JSX em `.ts`
- Sem `any` salvo justificativa explícita inline
- Imports em `api/` obrigatoriamente terminam com `.js` (NodeNext)
- **exactOptionalPropertyTypes:** nunca `key: value | undefined` — use spread-conditional `...(val != null ? { key: val } : {})`
- Tipos compartilhados: `src/types/database.ts` (gerado), `src/types/api.ts` (responses), `src/types/domain.ts` (negócio)

## Zod nos handlers

Todo handler `/api/*.ts`:
1. Schema em `api/_schemas/` (ou no topo se one-off)
2. `safeParse(req.body)` — retorna `400 { error: issues[0].message }` se inválido
3. Exporta `z.input<typeof Schema>` como tipo

## Primitivos canônicos (use estes, não recrie)

### Backend
- `api/_anthropic.ts` → `getAnthropic()`, `parseJsonFromLlm<T>()`, `htmlEscape()`
- `api/_supabase.ts` → `getSupabase()` (service key)
- `api/_google.ts` → `getAuthedClient(refreshToken)`, `getOAuthUrl(state)`, `GOOGLE_COLORS`
- `api/_middleware.ts` → `requireAuth`, `requireAdmin`, `requireCron`
- `api/_briefing-context.ts` → `fetchAqalContext(userId)` (compartilhado briefing+coach)
- `api/_coach.ts` → `buildCoachSnapshot`, `buildSystemPrompt`, `generateCoachParagraph`, `mapCoachMemoryRow`, `touchMemories`
- `api/_lib/rrule.ts` → `nextOccurrence(rrule, after)` (RRULE recurrence)

### Frontend
- `src/api.ts` → `api.get/post/patch/delete<T>()` (com `credentials: 'include'`)
- `src/hooks/AuthProvider.tsx` + `useAuth.ts`
- `src/hooks/CoachProvider.tsx` + `useCoach.ts` — **modelo canônico** de Provider+consumer (streaming, polling, optimistic updates)
- `src/components/layout/` → Topbar, BottomNav, Subtabs
- `src/components/common/` → ConfirmDialog (sempre em ação destrutiva), ThemeToggle, ErrorBoundary, Chip, Icon, SyncStatus
- `src/types/domain.ts` → `QUADRANT_COLORS` + `_SOFT`/`_INK`/`_VARS`, `QUADRANT_LABELS`, `projectColorSoft()` (paleta Seda AQAL)
- `src/lib/` → `dates.ts` (timezone), `coach.ts` (COACH_KIND_LABEL), `taskParser.ts` + `taskQueryParser.ts` (NLP capture/busca)
- `src/styles/globals.css` → CSS variables + classes utilitárias (`.task-panel`, `.btn`, `.section`, etc.)

## Padrões de código (recap)

### Anthropic
```typescript
import { getAnthropic, parseJsonFromLlm, htmlEscape } from './_anthropic.js'
const msg = await getAnthropic().messages.create({
  model: 'claude-haiku-4-5-20251001',  // ou claude-sonnet-4-6
  max_tokens: 512,
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: prompt }],
})
const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
const parsed = parseJsonFromLlm<{ items: Item[] }>(raw)
```

**Quando usar qual modelo:** Haiku para classificar/parsing/extrair JSON. Sonnet para chat/escrita criativa/raciocínio.

### Google write-back (best-effort)
```typescript
// Local save sempre sucede
const { data: row } = await supabase.from('events').insert(...).select().single()

// Google é separado, try/catch, não falha o request
try {
  if (!refreshToken) { console.warn('[save] no refresh_token'); return res.status(200).json({ event: row }) }
  await google.calendar({...}).events.insert({...})
} catch (e) {
  console.error('[save] google push failed:', e instanceof Error ? e.message : e)
}
return res.status(200).json({ event: row })
```

### Upsert dual-pass (Google sync)
Tabela precisa ter UNIQUE CONSTRAINT (não partial index) como arbiter.
```typescript
// Pass 1: insere novos
await supabase.from('contacts').upsert(rows, { onConflict: 'user_id,google_contact_id', ignoreDuplicates: true })
// Pass 2: atualiza existentes com subset de campos (preserva edits locais)
await supabase.from('contacts').upsert(rowsSubset, { onConflict: 'user_id,google_contact_id', ignoreDuplicates: false })
```

### Provider único + hook consumer
Quando estado é compartilhado entre múltiplos componentes:
```tsx
// hooks/XxxProvider.tsx
export const XxxContext = createContext<XxxContextValue | null>(null)
export function XxxProvider({ children }) {
  const { user } = useAuth()  // gate por auth
  const [state, setState] = useState(...)
  // mutações, polling com change-detection (setX(prev => prev === next ? prev : next))
  return <XxxContext.Provider value={...}>{children}</XxxContext.Provider>
}

// hooks/useXxx.ts (consumer only)
export function useXxx() {
  const ctx = useContext(XxxContext)
  if (!ctx) throw new Error('useXxx must be used within XxxProvider')
  return ctx
}

// App.tsx
<AuthProvider><XxxProvider><AppRoutes /></XxxProvider></AuthProvider>
```

### Cron
```typescript
// vercel.json
{ "crons": [{ "path": "/api/foo-cron", "schedule": "*/15 * * * *" }] }

// api/foo-cron.ts
export const maxDuration = 300
export default async function handler(req, res) {
  if (!requireCron(req, res)) return
  // itera users; idempotência via marker no content_md ou (user_id, date) check
}
```

### Mapping snake_case → camelCase
```typescript
interface XxxRow { id: string; user_id: string; ...; expires_at: string | null }
export function mapXxx(r: Partial<XxxRow>): XxxDto {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    relevance: r.relevance,
    ...(r.expires_at != null ? { expiresAt: r.expires_at } : {}),
  }
}
```

### Topbar com ações
Sempre extrair antes do return:
```tsx
const actions = (
  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
    <button className="sync-status" ...>Sync</button>
    <ThemeToggle />
  </div>
)
return <Topbar title="Tasks" actions={actions} />
```

### Props opcionais
```tsx
// ❌ ERRADO (exactOptionalPropertyTypes barra)
<EventPanel prefill={prefill} />  // prefill: T | undefined

// ✅ CORRETO
<EventPanel {...(prefill !== undefined ? { prefill } : {})} />
```

### Confirm dialog em destrutivo
```tsx
const [confirming, setConfirming] = useState(false)
<>
  <button onClick={() => setConfirming(true)}>Arquivar</button>
  {confirming && (
    <ConfirmDialog
      title="Arquivar tarefa?"
      message="Você pode restaurar depois."
      dangerous
      onConfirm={async () => { await archive(id); setConfirming(false) }}
      onCancel={() => setConfirming(false)}
    />
  )}
</>
```

## Comandos

```bash
npm run dev          # Vite dev (frontend)
npm run dev:api      # serverless local (tsx dev-server.ts)
npm run build        # tsc -b && vite build
npm run preview      # serve build
npm run test         # vitest
npm run db:types     # supabase gen types → src/types/database.ts
vercel env pull      # baixa env vars
```

## Variáveis de ambiente

```
# Obrigatórias
JWT_SECRET                       # 32+ chars
SUPABASE_URL
SUPABASE_SERVICE_KEY
ANTHROPIC_API_KEY
RESEND_API_KEY
CRON_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI

# Opcionais
RESEND_FROM_EMAIL                # default briefing@state.is
IMAP_HOST / IMAP_USER / IMAP_PASSWORD  # newsletter ingest (não impl.)
```

## Estrutura de pastas (resumo)

```
jp-app/
├── api/                          # 87 arquivos
│   ├── _anthropic.ts             # Singleton + parseJsonFromLlm + htmlEscape
│   ├── _briefing.ts              # Pipeline do briefing
│   ├── _briefing-context.ts      # fetchAqalContext (compartilhado coach+briefing)
│   ├── _coach.ts                 # Coach helpers (snapshot, prompt, paragraph, memory mapper)
│   ├── _env.ts / _google.ts / _middleware.ts / _supabase.ts
│   ├── _lib/                     # rrule.ts (recurrence) + tests
│   ├── _schemas/                 # area/coach/contact/event/habit/inbox/note/project/task/task-classify + tests
│   ├── auth-*.ts                 # login, logout, me
│   ├── areas-*.ts                # AQAL areas
│   ├── briefing-*.ts             # generate, cron, history
│   ├── calendars-*.ts            # Google Calendar
│   ├── coach-*.ts                # 13 endpoints (chat SSE, history, memory, profile, checkin-cron)
│   ├── contacts-*.ts             # CRM + Google People sync
│   ├── dashboard-aqal.ts         # Mandala AQAL
│   ├── events-*.ts               # Calendar events + NLP parse
│   ├── google-oauth.ts           # OAuth flow
│   ├── habits-*.ts + habit-logs-save.ts + habits-streaks.ts
│   ├── inbox-*.ts                # GTD inbox
│   ├── interactions-*.ts         # Contact interactions
│   ├── news-*.ts + sources-*.ts  # RSS + News
│   ├── notes-*.ts + note-folders-*.ts + note-tags-*.ts
│   ├── projects-*.ts             # H1 projects
│   ├── rituals-*.ts              # Habit sequences
│   ├── tasks-*.ts + tasks-classify.ts + tasks-sync.ts
│   └── tsconfig.json
├── src/
│   ├── App.tsx                   # <AuthProvider><CoachProvider><AppRoutes/>
│   ├── api.ts                    # fetch wrapper tipado
│   ├── pages/                    # 11 páginas (Briefing, Tasks, Calendar, Contatos, Notas, News, Areas, Projects, Dashboard, Config, Login)
│   ├── components/
│   │   ├── layout/               # Topbar, BottomNav, Subtabs
│   │   ├── common/               # ConfirmDialog, ThemeToggle, ErrorBoundary, Chip, Icon, SyncStatus
│   │   ├── calendar/             # AgendaView, WeekView, MonthView, EventPanel, CalendarPicker, etc.
│   │   ├── coach/                # CoachFab, CoachSheet, CoachMessage, CoachInput, CoachMemoryCandidates, CoachMemoryList, CoachProfilePanel
│   │   ├── contacts/             # ContactsList, FollowupsView, PipelineView, RelationshipsView, ContactPanel, InteractionModal
│   │   ├── inbox/                # InboxView
│   │   ├── notes/                # NoteCard, NotePanel, NoteEditor (Tiptap), AudioRecorder, FolderTree, TagManager
│   │   ├── projects/             # ProjectsView, ProjectRow, ProjectPanel, ProjectsCard
│   │   └── tasks/                # TodayView, KanbanView, ListView, TaskPanel, TaskRow, QuickAdd
│   ├── hooks/                    # AuthProvider, CoachProvider, useTheme + 16 hooks domain (useTasks, useAreas, useProjects, useHabits, useRituals, useInbox, useCalendars, useEvents, useContacts, useNotes, useNoteFolders, useNoteTags, useNews, useSources)
│   ├── lib/                      # dates.ts, colors.ts, coach.ts, taskParser.ts (+ test)
│   ├── types/                    # database.ts (gerado), api.ts (responses), domain.ts (negócio)
│   └── styles/globals.css        # CSS variables + classes utilitárias
├── supabase/migrations/          # 0001..0013
├── public/
├── dev-server.ts                 # Serverless local (tsx)
├── vercel.json                   # crons + maxDuration
├── .env.example
├── CLAUDE.md                     # este arquivo
├── SPEC.md                       # espinha completa do app
└── REVIEW.md                     # débitos técnicos abertos
```

## Hierarquia de autoridade quando em dúvida

1. **CLAUDE.md** (este arquivo) — regras operacionais
2. **SPEC.md** — espinha do app: módulos, schema, endpoints, integrações
3. **REVIEW.md** — débitos abertos
4. **Stack** → seção "Stack final" deste arquivo
5. **Visual** → `JP_App_Redesign_Implementation.md` (paleta Seda — linguagem atual) + `src/styles/globals.css` (verdade aplicada). `prototipo.html` é histórico (pré-Seda).
6. **Padrões** → seção "Padrões de código" deste arquivo

Quando algo não estiver coberto, **pergunte antes de codar**.
