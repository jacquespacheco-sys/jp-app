# PROMPT — JP App (Claude Code)

> Cole o conteúdo abaixo no Claude Code depois de colocar `BRIEFING.md` e `prototipo.html` na raiz de uma pasta nova `jp-app/`.

---

## Missão

Construir o **JP App** — assistente pessoal do Jorge com **5 módulos** (Briefing, Tasks, **Calendar**, Contatos, Configurações) — seguindo rigorosamente as decisões arquiteturais consolidadas em `BRIEFING.md`.

## Documentos de referência (leia TODOS antes de qualquer código)

1. **`BRIEFING.md`** — fonte da verdade do projeto. Contém: visão de produto, stack final, convenções de código (TypeScript + Zod), schema SQL, mapa de endpoints, especificação detalhada do módulo Calendar, pipeline de briefing, integrações Google, plano de fases, e Playbook arquitetural completo do STATE Superapp em anexo.
2. **`prototipo.html`** — fonte da verdade visual. Replicar **exatamente**: identidade STATE (Bebas Neue, Space Grotesk, Space Mono), accent verde-limão (`#a8ff00`), bordas finas, dark mode, bottom-nav com 5 itens.

## Hierarquia de autoridade quando houver conflito

1. Decisão de stack → `BRIEFING.md` seção 2 (Vite + TS + Zod, **não** Next.js/Prisma/shadcn)
2. Identidade visual → `prototipo.html`
3. Schema/endpoints/Calendar → `BRIEFING.md` seções 4, 5, 6
4. Padrões de código → `BRIEFING.md` Anexo A (Playbook)

## Princípios de execução

1. **TypeScript strict mode desde o commit 0.** `--template react-ts` no Vite. Sem `any` salvo justificativa explícita.
2. **Zod em TODO handler `/api/*.ts`.** Schema → `safeParse` → `z.infer` exporta o tipo. Schemas compartilhados em `api/_schemas/`.
3. **Tipos do Supabase gerados.** Script npm `db:types` roda `supabase gen types typescript --project-id ... > src/types/database.ts`. Usar em toda query.
4. **`api.ts` único** centraliza fetch tipado (`get/post/patch/delete` com `credentials: 'include'`).
5. **Cada arquivo `/api/*.ts` é uma rota.** Padrão `verbo-substantivo`: `tasks-save.ts`, `events-parse.ts`, `briefing-generate.ts`.
6. **`.ts` para lógica, `.tsx` para JSX.** Vite 8 com oxc não compila JSX em `.ts`.
7. **Cliente Supabase singleton** em `api/_supabase.ts`. Service key SÓ no backend.
8. **Middleware de auth** em `api/_middleware.ts` com `requireAuth(req, res)` retornando user tipado.
9. **Validação SEMPRE no backend.** O frontend pode tipar tudo, mas Zod no handler é o que protege.
10. **Carregamento paralelo** com `Promise.all` / `Promise.allSettled`.
11. **Funções de IA precisam de `maxDuration`** no `vercel.json`.
12. **Sync Calendar incremental** com `syncToken` (não polling completo). Cron `*/2 * * * *`.
13. **NLP de eventos via Haiku** em `/api/events-parse`, resposta validada por Zod antes de chegar ao frontend.
14. **Confirm dialog reutilizável** — toda ação destrutiva passa por ele.
15. **NUNCA commitar segredos.** `.env.local` no `.gitignore` desde o commit 0.

## Convenções de commit

- `feat:` nova funcionalidade
- `fix:` correção
- `chore:` manutenção
- `refactor:` melhoria sem mudar comportamento
- Commitar com frequência (ao final de cada subtarefa do plano).

## CLAUDE.md (criar primeiro)

Antes de qualquer outra coisa, gere `CLAUDE.md` na raiz com:
- Resumo do projeto (1 parágrafo)
- Stack final (copiar de `BRIEFING.md` seção 2)
- Anti-padrões: o que NÃO usar (seção 2.1)
- Convenções TypeScript + Zod (seção 3)
- Comandos: `npm run dev`, `npm run build`, `npm run db:types`, `vercel env pull`, `vercel dev`
- Estrutura de pastas (seção 3.3)
- Hierarquia de autoridade quando em dúvida

## Plano de execução por fases — pare ao fim de cada uma e peça aprovação

### FASE 0 — Fundação
1. Criar `CLAUDE.md`
2. `npm create vite@latest jp-app -- --template react-ts`
3. Instalar deps:
   ```
   npm i react-router-dom @supabase/supabase-js bcryptjs jsonwebtoken cookie zod
   npm i @anthropic-ai/sdk resend rss-parser imapflow googleapis
   npm i date-fns date-fns-tz @dnd-kit/core
   npm i -D @types/bcryptjs @types/jsonwebtoken @types/cookie @vercel/node
   npm i -D vitest @testing-library/react @testing-library/jest-dom msw supabase
   ```
4. `tsconfig.json` em strict mode (ver seção 3.1 do BRIEFING)
5. Estrutura de pastas conforme `BRIEFING.md` seção 3.3
6. `vercel.json` (seção 10) com crons e maxDuration
7. `.env.example` listando TODAS as vars (seção 9)
8. SQL completo do schema:
   - `supabase/migrations/0001_initial.sql` (seção 4)
   - `supabase/migrations/0002_calendar.sql` (seção 4, parte Calendar)
9. Script `npm run db:types` no `package.json`
10. `api/_supabase.ts`, `api/_middleware.ts`, `api/_schemas/` (Zod schemas base)
11. `api/auth-login.ts`, `api/auth-logout.ts`, `api/auth-me.ts`
12. `src/api.ts` (wrapper fetch tipado), `src/hooks/AuthProvider.tsx`, `src/hooks/useAuth.ts`
13. `src/App.tsx` com proteção de rotas (5 rotas)
14. `src/styles/globals.css` extraindo TODAS as variáveis CSS e estilos do `prototipo.html`
15. Layout base: `Topbar.tsx`, `BottomNav.tsx` (5 itens: Briefing/Tasks/**Calendar**/Contacts/Config), `Subtabs.tsx`, theme toggle
16. 5 páginas placeholder: `BriefingPage`, `TasksPage`, `CalendarPage`, `ContactsPage`, `ConfigPage`

**Critério de pronto:** `npm run build` sem erros TS, login funciona, navegação entre as 5 abas funciona, dark mode funciona, identidade visual fiel ao protótipo, tipos do Supabase gerando.

**Pare e peça aprovação.**

### FASE 1 — Tasks MVP
- Schemas Zod: `api/_schemas/task.ts`
- Endpoints: `tasks-list`, `tasks-save`, `tasks-archive`, `tasks-unarchive`, `projects-list`, `projects-save`
- Parser quick-add local (`src/lib/nlp/parseTask.ts`) + testes Vitest
- Views: TodayView, KanbanView (com `@dnd-kit/core`), ListView
- TaskPanel (edição), QuickAdd, ConfirmDialog reutilizável
- Hook `useTasks` com cache local

**Pare e peça aprovação.**

### FASE 2 — Sync Google Tasks
- OAuth flow (`/api/google-oauth`) salvando refresh_token criptografado
- Wrapper `src/lib/google/tasks.ts`
- `/api/sync-tasks` bidirecional com last-write-wins
- Cron `*/5 * * * *`
- UI: SyncStatus pill no Topbar

**Pare e peça aprovação.**

### FASE 3 — Calendar MVP
- Schemas Zod: `api/_schemas/event.ts`, `api/_schemas/calendar.ts`
- Endpoints: `calendars-list`, `calendars-toggle`, `events-list`, `events-save`, `events-delete`
- Wrapper `src/lib/google/calendar.ts` com sync incremental via `syncToken`
- `/api/sync-calendar` com tratamento de `410 Gone` (re-full-sync)
- Cron `*/2 * * * *`
- Views: DayView, WeekView, MonthView, AgendaView (responsivas — Week vira 3-day no mobile)
- EventBlock, EventPanel (editor lateral consistente com TaskPanel)
- CalendarPicker (toggle on/off + cor por sub-calendário)
- Conflict resolution + log em `event_logs`

**Pare e peça aprovação.**

### FASE 4 — Calendar avançado
- `/api/events-parse` com Haiku + validação Zod
- QuickAddEvent (barra fixa, bilíngue PT/EN)
- Confidence routing: high → cria + toast undo (5s); medium/low → preview no EventPanel
- Time-blocking: drag de TaskPill no calendário cria evento `source='task_block'` com `task_id`
- TaskPill (read-only overlay) no DayView/WeekView para tasks com `dueDate=hoje`

**Pare e peça aprovação.**

### FASE 5 — Briefing MVP
- Endpoints `sources-*`, `newsletters-*` (CRUD)
- `src/lib/rss.ts` (rss-parser)
- `src/lib/imap.ts` (imapflow)
- `/api/briefing-generate` orquestra: `Promise.all` (RSS + IMAP + Calendar + Tasks) → Haiku → persiste → email
- Validação Zod do JSON retornado pelo Haiku
- `/api/briefing-cron` (com `Authorization: Bearer ${CRON_SECRET}`)
- Vercel Cron `30 9 * * *`
- Template HTML do email (React Email opcional, HTML puro também serve)
- DashboardView + EmailPreview replicando o protótipo

**Pare e peça aprovação.**

### FASE 6 — Gantt + Projects Dashboard
- GanttView custom (referência: protótipo HTML)
- DependencyLines em SVG
- ProjectsDashboard com filtros
- Log de edições via `task_logs`

**Pare e peça aprovação.**

### FASE 7 — Contatos MVP
- Schemas Zod: `api/_schemas/contact.ts`
- Endpoints: `contacts-list`, `contacts-save`, `interactions-save`
- Views: ContactsList, FollowupsView
- ContactPanel + InteractionModal
- Sync Google People API (`/api/sync-contacts`)
- Cron `*/30 * * * *`

**Pare e peça aprovação.**

### FASE 8 — Contatos avançado
- PipelineView (kanban de phases)
- RelationshipsView (org-chart simples — SVG manual)
- BirthdaysStrip integrado ao briefing
- Vincular Tasks ↔ Contacts (campo `contact_id` em tasks)

**Pare e peça aprovação.**

### FASE 9 — Polimento e produção
- PWA manifest + service worker básico
- Error boundaries
- Sentry (opcional)
- Vitest cobrindo: parsers (task + event NLP), sync (tasks + calendar), geração de briefing, conflict resolution
- Smoke test em produção
- README final

## Antes de começar

1. Confirme que leu `BRIEFING.md` inteiro (incluindo o Anexo A — Playbook).
2. Confirme que leu `prototipo.html` para entender a identidade visual.
3. Liste **todas** as variáveis de ambiente que vou precisar criar no Vercel (com indicação de quais são obrigatórias para Fase 0 vs fases posteriores).
4. Liste o que preciso fazer manualmente:
   - **Supabase**: criar projeto, executar migrations 0001 e 0002, copiar URL + service key + anon key, anotar project ID para o `db:types`
   - **Google Cloud Console**: criar projeto, habilitar Tasks/Calendar/People APIs, criar OAuth Client ID, configurar redirect URI
   - **Resend**: criar conta, verificar domínio do email de envio
   - **Anthropic**: gerar API key
   - **IMAP**: criar email dedicado para newsletters (Gmail ou Zoho), gerar app password
5. Só depois execute a Fase 0.

Se alguma decisão não estiver coberta, **me pergunte antes de codar**. Não invente padrão novo. Quando em dúvida sobre estilo, copie do `prototipo.html`. Quando em dúvida sobre arquitetura, siga o Playbook (Anexo A do BRIEFING).
