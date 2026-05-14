# JP App — Contatos · Pacote de Implementação Carnegie
## 00 · Briefing executivo

> **Para colar no Claude Code como primeiro contexto.** Resume o que será feito, por que, e em que ordem. Os arquivos `01_*`, `02_*` e `03_*` complementam.

---

## 1. Reality check — o que JÁ existe

Reli `SPEC.md` e `CLAUDE.md`. O módulo Contacts **já está em produção** com:

**Tabelas existentes:** `contacts` (first_name, last_name, company, role, email, phone, address, birthday DD/MM, tags[], phase, next_contact, notes, google_contact_id, synced, archived) + `interactions` (contact_id FK, date, type [call/meeting/email/message], note)

**Endpoints existentes:** `contacts-list`, `contacts-save`, `contacts-sync`, `contacts-archive`, `interactions-list`, `interactions-save`

**Frontend existente:** `ContactsList`, `FollowupsView`, `PipelineView`, `RelationshipsView`, `ContactPanel`, `InteractionModal`, `useContacts()` (stateful, single-component)

**Integrações vivas:** Google People dual-pass upsert (preserva edits locais), Tasks (`contact_id` FK), Briefing (BirthdaysStrip parcial — listada como débito), Calendar (attendees sem enforcement).

**Stack real (não recriar):** Vite 6 + React 19 + TS strict + Supabase (SQL puro, **sem Prisma**) + Vercel serverless + Zod nos handlers + `getAnthropic()` singleton + cookie httpOnly + CSS variables (sem Tailwind).

---

## 2. O que muda — encaixe da camada Carnegie

A camada Carnegie/Rituais é **aditiva**, não substitui nada. Toda a infra existente continua funcionando — o que adicionamos:

### 2.1 Extensão da tabela `contacts` (sem quebrar)
Novos campos opcionais, todos com default null/seguro:
- `tier` (text: inner/strong/network/weak/dormant — null = não classificado)
- `cadence_days` (int — null usa default por tier)
- `last_interaction_at` (timestamptz — cache, populado por trigger)
- `preferred_name` (text)
- `interests` (text[] — hobbies, paixões)
- `conversation_hooks` (text[] — tópicos que destravam conversa)
- `what_they_value` (text — como se sente importante, P9)
- `their_goals` (text — o que querem, P3)
- `family` (jsonb — { spouse, children[], pets[] })
- `first_met_at` (timestamptz — alimenta data derivada)
- `company_start_date` (date — alimenta "STATE-versary")
- `preferred_channel` (text: whatsapp/email/linkedin/sms)
- `favor_balance` (int default 0 — saldo de generosidade)
- `linkedin_url`, `twitter_handle`, `instagram_handle` (text)
- `last_signal` (jsonb — { type, text, url, date })
- `last_signal_at` (timestamptz)
- `source_contact_id` (uuid FK contacts.id — quem indicou)
- `source_context` (text — "evento Bimbo", "indicação Marina")

**Observação importante:** mantemos `tags text[]` (consistente com debt nota, não migra agora). Mantemos `phase` para CRM comercial. **Tier ≠ phase** — coexistem.

### 2.2 Extensão da tabela `interactions`
- `initiator` (text: me/them)
- `sentiment` (text: positive/neutral/tense)
- `topics_discussed` (text[])
- `carnegie_tags` (text[] — P1..P30)
- `interaction_tags` (text[] — gave_intro, gave_referral, gave_advice, gave_gift, received_*, gratitude, compliment_received)
- `compliment_text` (text — se compliment_received)
- `referral_from_id` (uuid FK contacts.id — via indicação de quem)
- `new_learning` (text — o que aprendi sobre essa pessoa nesta interação)
- `promise_made` (text — promessa registrada inline)

### 2.3 Novas tabelas (migration 0014 — base Carnegie)
- `special_dates` — datas especiais expandidas (celebrate/acknowledge/silence/check_in)
- `referrals` — loop de indicação rastreável
- `compliments_received` — elogios recebidos para retribuir 4-6 meses depois

### 2.4 Novas tabelas (migration 0015 — rituais pessoais)
- `principle_of_month` — princípio do mês com aplicações contadas
- `weekly_reflections` — reflexão semanal (3 perguntas)
- `gratitude_entries` — diário de gratidão

### 2.5 Promessas: NÃO criar tabela nova
**Decisão (você aprovou no playbook v1):** promessas integram ao módulo Tasks via convenção:
- Task com tag `#promessa` + `contact_id` setado = promessa
- View `v_promises_open`: `tasks` filtrado por tag promessa + status open
- Reusa todo o sistema de Tasks (status, due_at, completion, archive)

### 2.6 View nova
- `v_contact_health` — health score (Maister: credibility, reliability, intimacy / self-orientation), populado de interactions + referrals + promessas cumpridas

---

## 3. Frontend — o que muda

### 3.1 Página Contatos: nova subtab "Pulso" (substitui Follow-ups)
A página `ContatosPage` já tem subtabs (Lista / Pipeline / Follow-ups / Relacionamentos). Adicionar:
- **"Pulso"** (nova landing) — princípio do mês banner, stats, datas especiais strip, loops a fechar, inner+strong em atraso, sinais
- **"Rituais"** (nova) — 4 cards (Thank You Tour, Reflexão semanal, Diário, Princípio do mês)
- Manter Lista, Pipeline, Relacionamentos
- "Follow-ups" pode ser deprecado/absorbido pelo Pulso

### 3.2 ContactPanel — novas abas
Adicionar abas: Carnegie / Datas / Elogios (mantém Interações, Família virtual em Carnegie).

### 3.3 Provider único (refactor recomendado)
`useContacts()` é stateful single-component. Como agora vamos consumir em Pulso, Rituais, Briefing — converter para `ContactsProvider` + `useContacts()` consumer (modelo `CoachProvider`).

### 3.4 Briefing matinal — integração
Adicionar ao `_briefing-context.ts` e `_briefing.ts`:
- `birthdaysToday`, `specialDatesToday` (celebrate/check_in/acknowledge)
- `loopsToClose` (referrals com outcome pendente)
- `principleOfMonth` (banner no topo do email)

### 3.5 Coach memory
Adicionar `contact_id` em `coach_memory.related_*` se já existir (verificar) — coach pode lembrar de coisas sobre pessoas.

---

## 4. Lógica de notificações (PWA push)

`vercel.json` já tem `briefing-cron` 09:30 BRT. Adicionar 3 crons:

- **`special-dates-cron`** — diário 08:00 BRT — itera datas `celebrate`/`check_in` do dia + envia push (web push) ou email mini
- **`rituals-cron`** — diário; sexta 18:00 (diário gratidão), domingo 19:00 (reflexão), 1ª segunda do mês (princípio), 1º dia do trimestre (thank you tour)
- **`signals-cron`** — 4x/dia — captura sinais LinkedIn (MVP: Google Alerts via email/IMAP futuro; fase 1: manual via UI)

**PWA Web Push:** marcado como débito no SPEC ("PWA manifest + service worker") — **não implementar nesta fase**. Por enquanto: lembretes via briefing (06:30/09:30) + cards in-app + email separado pros rituais.

---

## 5. Ordem de implementação — 5 PRs

Cada PR é menor e testável isoladamente. Recomendo ordem:

### PR 1 — Migration 0014 base Carnegie + extensões em contacts/interactions
**Escopo:** SQL puro, sem mudanças de UI ainda.
- `supabase/migrations/0014_carnegie_base.sql` (arquivo pronto neste pacote)
- `npm run db:types` regenera `src/types/database.ts`
- Atualiza `api/_schemas/contact.ts` e `interaction.ts` com novos campos opcionais
- Atualiza `mapContact()` / `mapInteraction()` para os novos campos
- Atualiza endpoints `contacts-save` e `interactions-save` para aceitar novos campos (todos opcionais)
- **Testes:** Zod schemas (`*.test.ts`)

**Critério de aceite:** `npm test && npm run build` passam. Schema novo no banco. UI continua igual mas backend já aceita os novos campos via API.

### PR 2 — Migration 0015 rituais + endpoints CRUD
- `supabase/migrations/0015_rituals_personal.sql` (arquivo pronto)
- Endpoints: `special-dates-*`, `referrals-*`, `compliments-*`, `principle-of-month-*`, `weekly-reflections-*`, `gratitude-entries-*` (todos: list, save, archive)
- Schemas Zod + testes
- Hook `useSpecialDates()` (stateful por enquanto), idem outros

### PR 3 — ContactsProvider + ContactPanel novas abas
- Converter `useContacts()` em `ContactsProvider` + `useContacts()` consumer (modelo `CoachProvider`)
- ContactPanel: nova aba "Carnegie" (campos do P3/P8/P9 + interests + hooks + what_they_value + their_goals + family)
- ContactPanel: nova aba "Datas" (CRUD inline `special_dates`)
- ContactPanel: nova aba "Elogios" (lista `compliments_received` + botão "Retribuído")
- Tier dropdown no header do ContactPanel

### PR 4 — Subtab Pulso + Rituais
- Nova subtab "Pulso" em `ContatosPage` (PulseView component novo)
  - Banner Princípio do Mês (consome `principle-of-month-current`)
  - Stats (overdue inner/strong, promessas, streak)
  - Datas especiais strip (consome `special-dates-upcoming`)
  - Loops a fechar (consome `referrals-pending`)
  - Inner+Strong em atraso (filter de `contacts` por tier + last_interaction_at)
- Nova subtab "Rituais" (RitualsView component novo)
  - ThankYouTour card (Q trimestral)
  - WeeklyReflection card + modal
  - GratitudeDiary card + modal
  - PrincipleOfMonth card

### PR 5 — Crons + briefing integration + suggest message API
- Cron `special-dates-cron` (08:00 BRT) → push email simples se houver `celebrate`/`check_in` do dia
- Cron `rituals-cron` (multi-trigger) → email lembrando ritual da vez
- Atualizar `_briefing-context.ts` para incluir `birthdaysToday`, `specialDatesToday`, `loopsToClose`, `principleOfMonth`
- Atualizar `_briefing.ts` template HTML para renderizar essas seções
- Novo endpoint `contacts-suggest-message` (Sonnet) — 2 ângulos por contexto

### PR 6 (opcional / futuro) — Health score + Dunbar dashboard
- View `v_contact_health` (computa CRED/CONF/INT/AO → score 0-100)
- Endpoint `contacts-network-stats` (Dunbar buckets + health top 10)
- Nova subtab "Rede" (substitui RelationshipsView atual ou ao lado)

---

## 6. Decisões já tomadas (não rediscutir)

Para acelerar a implementação, estas decisões já estão fechadas:

1. **Promessas = Tasks com tag.** Não criar tabela nova.
2. **Datas em string DD/MM ou date completa.** `special_dates.date_anniversary` (text DD/MM para recorrentes) + `date_full` (date para datas únicas).
3. **Tier coexiste com phase.** Tier é cadência relacional, phase é CRM comercial.
4. **PWA push fica para depois.** Lembretes via briefing/email/in-app cards.
5. **Frontend só após migrations.** Banco primeiro (PRs 1-2), UI depois (PRs 3-4).
6. **Provider único para Contacts.** Refatorar `useContacts` (modelo CoachProvider).
7. **Sinais LinkedIn: MVP manual.** UI permite registrar sinal manualmente; automação RSS/scraper fica fora desta fase.
8. **Sem ORM, sem Prisma.** Tudo SQL puro via Supabase, conforme `CLAUDE.md`.
9. **Anthropic via `getAnthropic()`.** Modelo: Haiku para sugerir mensagem, Sonnet pra retrospectiva anual.
10. **Tags em array (mantém debt).** `interaction_tags`, `carnegie_tags` como `text[]` (consistente com `tasks.tags`, `contacts.tags`).
11. **Categorias estruturadas em dimensões.** Sistema multidimensional com tabelas próprias (`category_dimensions`, `categories`, `contact_categories`) — não usa `tags[]`. User cria as dimensões (Perfil/Assunto/Aproximação/etc) e as categorias dentro delas. Múltipla atribuição por dimensão, cor opcional. Seed inicial cria 3 dimensões + 12 categorias. **Vai no PR 8** (entre PR 3 e PR 4).
12. **`contacts.tags[]` legado mantido.** A coluna existente continua, mas não é mais a fonte primária de classificação. Pode virar onda 4 de onboarding no futuro (migrar tags pra categorias).

---

## 7. O que está fora desta fase (parking lot)

Itens do playbook + anexo que ficam para depois:
- Power List Top 50 (cluster de inteligência avançada)
- Eventos sugeridos / "apresente A pra B"
- Cluster por cidade durante viagens
- Sumiço detectado (anomaly detection)
- Modo luto, modo descanso, modo viagem (configurações)
- PWA notifications reais
- LinkedIn scraping / RSS de sinais
- Retrospectiva anual auto-gerada (cron 23/dez)
- Editorial planner LinkedIn

Anotar em REVIEW.md como "Carnegie v2 / parking lot".

---

## 8. Checklist final antes de começar

Para o Claude Code começar, garantir que:
- [ ] Branch nova: `git checkout -b feature/carnegie-contatos`
- [ ] `vercel env pull` recente
- [ ] `npm install` ok
- [ ] `npm test` passa no estado atual
- [ ] `npm run build` passa no estado atual
- [ ] Backup do banco (Supabase dashboard → Backups)

---

*Arquivos deste pacote:*
- `00_BRIEFING.md` — este arquivo
- `01_MIGRATION_0014_carnegie_base.sql` — SQL para campos novos em contacts/interactions + tabelas special_dates/referrals/compliments
- `02_MIGRATION_0015_rituals_personal.sql` — SQL para tabelas principle_of_month, weekly_reflections, gratitude_entries
- `03_PROMPTS_CLAUDE_CODE.md` — sequência exata de prompts para o Claude Code, em ordem de PR
- `04_ONBOARDING_DATA_MIGRATION.md` — estratégia das 3 ondas para popular base existente
- `05_SQL_initial_classification.sql` — script SQL idempotente para Onda 1 (classificação automática)
- `06_PROMPT_PR7_onboarding_wizard.md` — prompt opcional para wizard de revisão guiada (Onda 2)
- `07_MIGRATION_0016_categories.sql` — SQL para sistema de categorias multidimensionais + seed
- `08_PROMPT_PR8_categories.md` — prompt para PR 8 (categorias + chips + filtros)
