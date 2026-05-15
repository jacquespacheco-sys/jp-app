# Histórico de Sessões de Review/Refactor

---

## Sessão Redesign Seda + Tasks/Kanban (2026-05-15) — branch `feature/redesign-seda`

10 commits. Em teste prático pelo usuário por alguns dias antes de novos ajustes.

**Redesign visual "ClickUp Seda"** (plano: `JP_App_Redesign_Implementation.md`):
- Fontes: Bebas/Space Grotesk/Space Mono → Fraunces/General Sans/JetBrains Mono
- CSS vars: paleta seda completa (creme/marrom-tinta light, preto-tinta/creme dark), 7 cores funcionais translúcidas, gradiente Coach, tokens tipográficos
- `QUADRANT_COLORS` em `domain.ts` → seda + `_SOFT`/`_INK`/`_VARS`/`projectColorSoft()`
- Auditoria: 27 hex literais + 98 `fontFamily` inline → tokens
- App icon: triângulo lilás (era "JP" lime); sw.js auto-desregistra em dev

**Tasks/Projetos/Kanban:**
- Kanban drag: causa raiz era text-selection roubando o gesto em cards com texto → `user-select:none` + remoção de `memo` + DragOverlay + `pointerWithin`
- Quadrante filtrado por `quadrantOverride ?? resolvedQuadrant` (resolvedQuadrant é stale pós-save até refetch)
- Horizonte derivado da data da task (fallback horizonte do projeto); done/cancelled fora dos modos não-status; contexto arrastável
- Chip AQAL em todo TaskRow; cor distinta por projeto (+picker, +hash determinístico p/ cor legada); modo AQAL em ProjectsView; filter row removida
- NLP smart capture/search (`taskParser` estendido + `taskQueryParser`)
- Portas dev env-driven (`API_PORT`/`VITE_PORT`, defaults 3001/3000)

**Pendências conhecidas / a validar no uso:**
- Drag do Kanban precisa validação prática nos 5 modos (fix de text-selection é a hipótese principal, não testável headless)
- `prototipo.html` agora é histórico (pré-Seda) — não é mais fonte de verdade visual
- Cores legadas de projeto (`#7dd3fc`/`#CFE3E8`) recebem cor por hash do id em ProjectRow até o usuário escolher no picker (sem migration de DB)

---

# Coach MVP — Code Review Findings (2026-05-13)

Pós-merge do branch `feat/coach-mvp` (commit `916ad51`). 4 agentes paralelos: reuse, quality, efficiency, security. O que foi feito nessa sessão e o que ficou para próxima.

---

## ✅ Fixado nessa sessão

### Onda 1 — Cleanup (commit pendente)
- **`api/_anthropic.ts` novo** — singleton `getAnthropic()`, `parseJsonFromLlm<T>()`, `htmlEscape()`
- **`mapCoachMemoryRow` extraído** para `_coach.ts` — substituiu 3 cópias duplicadas (list, save, accept)
- **`generateCoachParagraph` movido** de `_briefing.ts` para `_coach.ts` — quebra acoplamento direção errada
- **`SLOT_CONFIG` em `coach-checkin-cron.ts`** — substituiu 3 ternários espalhados por slot config keyed
- **`COACH_KIND_LABEL` único** em `src/lib/coach.ts` — substitui dups em CoachMemoryCandidates + CoachMemoryList
- **`parseJsonFromLlm` adotado** em: `coach-memory-extract.ts`, `_briefing.ts`, `tasks-classify.ts`
- **`htmlEscape` adotado** em: `coach-checkin-cron.ts`, `_briefing.ts` (substituiu `replace(/</g, '&lt;')` parcial)
- **`getAnthropic` adotado** em `tasks-classify.ts` (estava com `new Anthropic({apiKey})`)
- **`exactOptionalPropertyTypes` corrigido** — `coach-profile.ts` mapProfile, `coach-memory-pending.ts` mapCandidate
- **Comentários "Step N:" removidos** de `coach-chat.ts` (violavam regra "comentar porquê, não o quê")
- **Generic error message no SSE** — `coach-chat.ts` envia `'erro no coach'` ao cliente, loga detalhe no servidor
- **`coach-memory-save.ts`** — agora retorna 404 quando UPDATE não encontra row (era 500)

### Onda 2 — Arquitetural (commit pendente)
- **`CoachProvider` único** — `src/hooks/CoachProvider.tsx`, montado em `App.tsx` dentro de `AuthProvider`. `useCoach()` virou só consumer do context. Elimina 4× fan-out (CoachFab + Sheet + MemoryList + ProfilePanel cada um instanciava o hook).
- **SSE `done` event com IDs reais** — `coach-chat.ts` retorna `userMsgId`/`coachMsgId`/`coachCreatedAt`. Frontend troca temp-IDs in-place; eliminado refetch de 100 msgs após cada turn.
- **SSE abort cleanup** — `req.on('close')` aborta o stream Anthropic e persiste o parcial em `coach_log`. Antes: cliente desconecta → server segue gastando tokens; agora: aborta e mantém o que foi gerado.
- **Polling unread com change-detection** — `setUnread(prev => prev === r.unread ? prev : r.unread)`.

---

## 🟡 Backlog (não-bloqueador, deixado para próxima sessão)

### Reuse
- **Helper de timezone local** (`userLocalDateStr(tz)`, `dayBoundsUtc(date, tz)`) — duplicado entre `_coach.ts:58-63` e `coach-checkin-cron.ts:34-48`. Pequeno; baixa prioridade.
- **Email layout helper** (`renderStateEmail({title, blocks})`) — header STATE + dark theme duplicado entre `_briefing.ts` e `coach-checkin-cron.ts`. Refactor de visual; pode esperar.
- **`api/_schemas/index.ts` desatualizado** — não re-exporta coach, habit, inbox, project, task-classify. Consumidores importam direto, funciona; só inconsistência.

### Quality
- **`useCoach.ts` cast forte para Database['public']['Tables']`** em `_coach.ts:107-149` — diversos `as` em volta de rows do Supabase. Tipar via geração `Database` seria mais limpo. Volumoso, baixa prioridade.
- **`UserWithProfile` em `coach-checkin-cron.ts:104`** — `as unknown as UserWithProfile[]` duplica typing. Schema strict para `check_in_schedule` em `_schemas/coach.ts` resolveria.
- **Inline style repetition** em `CoachProfilePanel`, `CoachInput`, `CoachSheet`, `CoachMemoryCandidates` — 6 props CSS repetidos ~10x cada. Criar classes utilitárias (`.coach-input`, `.coach-label`, `.coach-pill`) em `styles/globals.css` em vez de inline.
- **`buildChatContext` extraído + testado** — lógica de 50 linhas em `coach-chat.ts:60-106` (session-gap walk, drop-leading-assistant, collapse-consecutive-roles) sem testes unitários. Mover para `_coach.ts` com cobertura Vitest. ROI alto se essa lógica ganhar mais regras.
- **Slot marker em conteúdo** — `coach-checkin-cron.ts` injeta `<!-- slot -->` no `content_md` para idempotência. Frágil (mistura controle + display). Idealmente: coluna dedicada em `coach_log` ou em `context_snapshot.slot`.

### Efficiency
- **Cron serial cross-user** — `coach-checkin-cron.ts` itera users em `for-await`. Funciona com 1 user. Quando multi-user crescer: `Promise.allSettled` com concurrency cap (3) respeitando Anthropic rate-limit.
- **Streaming text força re-render de toda lista** — cada delta faz `setMessages(prev => prev.map(...))` no provider, então CoachSheet re-renderiza day-grouping inteiro. Para conversas longas: mover buffer de streaming para `useRef` + estado local no `CoachMessage` que está streamando; commitar no `done`.
- **Auto-scroll dispara a cada delta** — `useEffect(...[messages])` em CoachSheet faz scrollTop = scrollHeight em cada token. Throttle com `requestAnimationFrame`.
- **`coach-memory-list` retorna `select('*')`** — colunas extras desnecessárias. Selecionar só o que `mapCoachMemoryRow` usa.
- **`coach-unread` faz 2 round-trips** — read `coach_last_read_at` + count. Poderia ser RPC ou view com `count + last_read_at`.
- **Day-grouping em CoachSheet** — recomputado a cada render; memoizar via `useMemo`.

### Security
- **Rate limit por user em `/api/coach-chat`** — sem proteção contra spam. Single-user hoje, sem prejuízo. Para multi-user: token bucket no Redis ou tabela `rate_limits`.
- **`requireCron` sem validação de env** — se `CRON_SECRET` estiver vazio, qualquer requisição com `Authorization: Bearer ` passa. Defense-in-depth: throw na startup se `CRON_SECRET` ausente.
- **Cross-user FK em `coach_memory_candidate.source_log_id`** — sem CHECK enforcing same-user. Hoje só o extract handler escreve essa coluna e ele valida ownership, mas é defense-in-depth para multi-user.
- **Não há findings críticos ou high** — isolation multi-tenant está consistente. Memory extraction não permite cross-tenant write (user_id sempre tagged via auth).

### Infra
- **`npm run db:types` com `YOUR_SUPABASE_PROJECT_ID` placeholder** — script em `package.json` nunca foi finalizado. `src/types/database.ts` segue mantido a mão (padrão `// Coach (0013)`, `// Carnegie (0014)`). Quando quiser regen funcional: trocar pra `--project-id $SUPABASE_PROJECT_ID` (env-driven) e aceitar perda de precisão dos enums declarados manualmente (Postgres `text + check` vira `string` no auto-gen).

### Carnegie (parking lot — fora do escopo desta fase, ver `carnegie-contatos/00_BRIEFING.md` §7)
- Power List Top 50 (cluster de inteligência avançada)
- Eventos sugeridos / "apresente A pra B"
- Cluster por cidade durante viagens
- Sumiço detectado (anomaly detection)
- Modos luto/descanso/viagem
- PWA notifications reais
- LinkedIn scraping / RSS de sinais
- Retrospectiva anual auto-gerada (cron 23/dez)
- Editorial planner LinkedIn

### Carnegie (riscos conhecidos do PR1, baixo impacto)
- **`update_contact_favor_balance` só dispara em INSERT** — editar/arquivar interaction não recalcula `contacts.favor_balance`, o saldo derrapa silenciosamente. Aceitável enquanto interactions são append-only via UI; revisitar se entrar UI de edit/delete.
- **`update_contact_last_interaction` faz `select max(date)`** a cada insert/update — single insert é trivial, mas import em lote pode ficar pesado. Alternativa barata: `GREATEST(last_interaction_at, new.date)` em INSERT.
- **`carnegie_tags`/`interaction_tags` sem GIN index** — queries de contagem por princípio (P1..P30) vão fazer seq scan. Adicionar GIN se PR4 `principle-of-month-current` ficar lento.
- **Promessa duplicada** — `interactions.promise_made` (text) coexiste com Tasks `#promessa + contact_id`. Decisão ainda não escrita: backend cria task automaticamente quando `promise_made` é setado? Definir antes de wirar UI de interaction.

### Carnegie PR4-8 follow-ups (em aberto)
- **Pulso: "promessas count" + "streak" cards** — fora do PR4 (sem endpoint `tasks-list?tag=promessa` e sem definição de streak). Adicionar quando essas duas conversas tiverem decisão.
- **Pulso: count de aplicações do princípio do mês** — não renderizado no banner. Exige `select count(*) from interactions where carnegie_tags @> '{P7}' AND month=current`. Adicionar quando GIN entrar.
- **ThankYouTour: sem ação concreta** — só lista top contatos. Próximo passo: integrar com `SuggestMessageModal` para mandar mensagem direto da lista (modal já existe).
- **`special-dates-cron`/`rituals-cron`: idempotência via `coach_log`** — mistura levemente domínios (Carnegie escreve no log do Coach). Aceitável; revisitar se ficar bagunçado, com tabela `daily_notifications_log` dedicada.
- **`contacts-suggest-message`: Sonnet vs Haiku** — segui decisão 9 do briefing (Haiku). Se a qualidade ficar fraca, basta trocar para `claude-sonnet-4-6` em `api/contacts-suggest-message.ts:11`.
- **PR8 ConfigPage: sem drag-reorder de dimensões/categorias** — só sort_order via número. Adicionar @dnd-kit se for valer a pena.
- **PR8 view `v_contacts_with_categories` quebra filtro por archived** — a view tem `where c.archived = false` hard-coded. `contacts-archive` não vai aparecer no list (correto), mas `contacts-list?includeArchived=true` não funciona. Aceitável (não usado hoje).
- **PR8 contact card: chips overflow** — em telas estreitas com 3 chips longos, o layout pode quebrar. Ajustar grid de ContactRow se aparecer.
- **PR8 chip cores em light mode** — paletas foram calibradas no chute (a partir do design system existente). Pode precisar afinação visual no light theme.
- **PR7 wizard sem teste de render** — só teste de schema. Component test exige react-testing-library (não em deps); ficar de fora.
- **PR7 wizard categorias: multi-select é click-on-chip** — sem visual claro de "selected vs not". Apenas opacity 0.5/1. UX pode ser melhor.
- **Bundle size: 961k JS** (gzip 286k) — passou do warning de 500k. Code-splitting via dynamic imports nos pages é a próxima otimização.
- **PR6 (opcional, não implementado)** — Health score + Dunbar dashboard. Briefing diz "fase futura". `v_contact_health` mencionada em §2.6 do briefing mas nunca foi escrita nem em SQL.

### Carnegie PR4-8 follow-ups (resolvidos em cleanup pós-PR8)
- ~~FilterBar só em ContactsList~~ → aplicado em Pulso, Lista e Pipeline. PulseView aceita prop `filter` e aplica via `matchesContactFilter`.
- ~~Suggest-message: sem UI~~ → `SuggestMessageModal` + botão "✨ Sugerir" no header do ContactPanel.
- ~~Helper de timezone duplicado~~ → extraído para `api/_tz.ts` (`userLocalNow`, `inMinuteWindow`, `defaultTz`). 3 crons migrados.
- ~~PR7 inner > 5 só mostra aviso vermelho~~ → confirmação modal explícita ao tentar marcar 6º Inner.
- ~~PR8 categorias do filtro localStorage~~ → `useEffect` em ContactsPage limpa IDs órfãos quando categorias carregam.
- ~~Filter logic duplicado entre ContactsPage e PulseView~~ → extraído para `src/lib/contactFilter.ts`.
- ~~Imports `.ts` em `categories-list.ts` e `contacts-list.ts`~~ → corrigidos para `.js` (padrão NodeNext).

---

## Métricas
- **Arquivos tocados na Onda 1+2:** 18
- **LOC líquido:** -~120 (mais limpeza que adição)
- **Tests:** 139 passando antes e depois
- **Build:** limpo antes e depois

---

## Como continuar daqui

Quando voltar a este código:
1. Ler este REVIEW.md primeiro para saber o que está aberto
2. Itens marcados "ROI alto" no backlog: `buildChatContext` + testes, classes CSS no globals.css
3. Itens condicionais a "quando multi-user": rate limit, cron paralelo, FK check
4. Antes de mexer estrutura do Coach: rodar `npm test` para garantir baseline 139
