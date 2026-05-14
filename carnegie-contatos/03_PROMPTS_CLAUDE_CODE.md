# JP App — Contatos · Pacote de Implementação Carnegie
## 03 · Prompts para Claude Code

> **Como usar este arquivo:** cole cada prompt no Claude Code **um por vez**, em ordem. Cada prompt corresponde a um PR pequeno e testável. Espere o Claude Code terminar o PR (testes verdes + build verde) antes de partir para o próximo. **Não cole tudo de uma vez** — você perde controle e o contexto fica gigante.

> **Antes de começar:** já fez backup do banco no Supabase dashboard? `git checkout -b feature/carnegie-contatos`? `npm test && npm run build` passam no estado atual? Se sim, prossiga.

---

## Prompt 0 — Setup de contexto (cole primeiro, sempre)

```
Vou implementar uma camada nova no módulo Contatos do JP App, inspirada em Dale Carnegie + Ferrazzi + Maister + Dunbar + Adam Grant. A camada é aditiva: estende contacts/interactions e adiciona tabelas para datas especiais, indicações, elogios e rituais pessoais.

Antes de começar:
1. Leia `CLAUDE.md` completo (regras operacionais, padrões, anti-padrões)
2. Leia `SPEC.md` §3 (mapa de módulos), §5 (primitivos), §6 (reusar antes de criar), §7 (data model), §9.8 (Contacts)
3. Leia os 3 arquivos do pacote Carnegie que estão na raiz do repo:
   - `carnegie-pack/00_BRIEFING.md`
   - `carnegie-pack/01_MIGRATION_0014_carnegie_base.sql`
   - `carnegie-pack/02_MIGRATION_0015_rituals_personal.sql`

Depois de ler, responda em 1 parágrafo:
- O que você entendeu que vai mudar?
- Há alguma decisão do briefing que conflita com SPEC/CLAUDE.md?
- Vê algum risco que eu não mencionei?

Não escreva código ainda. Aguarde meu OK depois da sua resposta.
```

---

## PR 1 — Migration 0014 + schemas + handlers

Quando o Claude Code tiver respondido ao Prompt 0 e você confirmou, cole:

```
OK, vamos para o PR 1. Escopo: migration 0014 + schemas Zod + atualização dos handlers contacts-save e interactions-save para aceitar os campos novos. Sem mudanças de UI.

Tarefas:

1. Copiar `carnegie-pack/01_MIGRATION_0014_carnegie_base.sql` para `supabase/migrations/0014_carnegie_base.sql`. Não modificar o conteúdo do SQL — ele já foi planejado.

2. Aplicar a migration no Supabase (eu mesmo aplico via dashboard ou CLI — você só me lembra do passo).

3. Rodar `npm run db:types` para regenerar `src/types/database.ts`.

4. Atualizar `api/_schemas/contact.ts`:
   - Adicionar campos novos como opcionais com Zod (tier enum, cadence_days int positivo, preferred_name string, interests/conversation_hooks arrays de string, what_they_value/their_goals string, family jsonb passthrough, first_met_at/company_start_date date-string, preferred_channel enum, linkedin_url/twitter_handle/instagram_handle string, source_contact_id uuid, source_context string)
   - Todos opcionais. Validar enums.
   - Manter compatibilidade com payloads antigos (sem os novos campos).

5. Atualizar `api/_schemas/interaction.ts`:
   - Adicionar: initiator enum (me/them), sentiment enum (positive/neutral/tense), topics_discussed string[], carnegie_tags string[] (regex `^P([1-9]|[12][0-9]|30)$`), interaction_tags string[] (enum lista de gave_*/received_*/gratitude/compliment_received/wrote_recommendation), compliment_text string, referral_from_id uuid, new_learning string, promise_made string.
   - Todos opcionais.

6. Atualizar `api/contacts-save.ts`:
   - Aceitar os novos campos no body
   - Persistir em snake_case (mapear no upsert)
   - Manter dual-pass Google sync intacto (Pass 2 NÃO deve sobrescrever os campos novos — eles são edits locais)

7. Atualizar `api/interactions-save.ts`:
   - Aceitar os campos novos no body
   - Persistir snake_case
   - Se `promise_made` vier preenchido: criar uma task com tag '#promessa', contact_id setado, status='next', title=promise_made, area_id pode ficar null inicialmente

8. Atualizar `src/types/domain.ts`:
   - Tipo Contact com novos campos opcionais (camelCase)
   - Tipo Interaction com novos campos opcionais (camelCase)
   - Mappers (snake → camel) em `api/_schemas/contact.ts` e `interaction.ts` ou nos handlers (mantendo o padrão existente do repo)

9. Testes Zod:
   - `api/_schemas/contact.test.ts`: payload com novos campos válidos e inválidos
   - `api/_schemas/interaction.test.ts`: idem

10. **Validação final:** `npm test && npm run build` precisam passar.

Critério de aceite: API aceita e persiste todos os campos novos. UI continua igual (não vamos editá-la neste PR). Backend pronto para o frontend consumir.

Não toque em arquivos do frontend (`src/components/contacts/*`, `src/hooks/useContacts.ts`) neste PR. Só schemas + handlers + types + migration.
```

---

## PR 2 — Migration 0015 + CRUD de special_dates/referrals/compliments/rituais

Após PR 1 mergeado, cole:

```
OK, PR 2. Escopo: migration 0015 + endpoints CRUD para todas as novas tabelas (special_dates, referrals, compliments_received, principle_of_month, weekly_reflections, gratitude_entries). Sem UI ainda.

Tarefas:

1. Copiar `carnegie-pack/02_MIGRATION_0015_rituals_personal.sql` para `supabase/migrations/0015_rituals_personal.sql`. Aplicar.

2. `npm run db:types` para regenerar tipos.

3. Para cada uma das 6 tabelas (special_dates, referrals, compliments_received, principle_of_month, weekly_reflections, gratitude_entries), criar:
   - Schema Zod em `api/_schemas/<name>.ts` (ex: `special-date.ts`)
   - Handler `api/<name>-list.ts` (GET, filtros típicos: contactId, status, dateRange)
   - Handler `api/<name>-save.ts` (POST/PATCH, upsert)
   - Handler `api/<name>-delete.ts` (POST com id, hard-delete OK pra special_dates/compliments; soft-delete pra referrals se preferir)
   - Mapper snake → camel
   - Testes Zod

4. Endpoints específicos extras:
   - `api/special-dates-upcoming.ts` — GET `?days=7` retorna datas dos próximos N dias (recorrentes + únicas), agrupadas por tipo
   - `api/referrals-pending.ts` — GET retorna referrals com status='open' e feedback_given=false, ordenados por created_at
   - `api/compliments-due-for-reciprocation.ts` — GET retorna compliments com remind_to_reciprocate_at <= now() e reciprocated=false
   - `api/principle-of-month-current.ts` — GET retorna principle_of_month do mês corrente (cria sentry se não existir, com lógica de seleção: rotacionar pelos P1..P30, priorizando princípios menos usados no trimestre anterior — pode ser simples nesta fase: pegar próximo da sequência, ou random ponderado)

5. Hooks frontend stateful (modelo dos hooks existentes — Provider vem no PR 3):
   - `src/hooks/useSpecialDates.ts`
   - `src/hooks/useReferrals.ts`
   - `src/hooks/useCompliments.ts`
   - `src/hooks/usePrincipleOfMonth.ts`
   - `src/hooks/useWeeklyReflections.ts`
   - `src/hooks/useGratitudeEntries.ts`
   Cada um expõe `{ items/data, loading, save, delete, refetch }` com tipos camelCase de domain.ts.

6. Atualizar `src/types/domain.ts` com os tipos das novas entidades.

7. **Validação:** `npm test && npm run build`.

Critério de aceite: todos os endpoints retornam shape correto, validações Zod pegam payloads inválidos, hooks fetcham e mutacionam. Nenhuma página ainda usa esses hooks — eles só existem.

Padrões obrigatórios (do CLAUDE.md):
- `requireAuth` em todo handler
- `safeParse` com 400 + issues[0].message
- Filtro `user_id = user.id` em toda query
- spread-conditional para campos opcionais no mapper
- Imports `.js` em api/ (NodeNext)
```

---

## PR 3 — ContactsProvider + novas abas no ContactPanel

Após PR 2 mergeado, cole:

```
OK, PR 3. Escopo: refatorar useContacts para ContactsProvider+useContacts (modelo CoachProvider), e adicionar 3 abas novas ao ContactPanel: Carnegie, Datas, Elogios. Tier dropdown no header.

Tarefas:

1. Criar `src/hooks/ContactsProvider.tsx` seguindo exatamente o padrão de `CoachProvider.tsx`:
   - Context, Provider component
   - Estado: contacts, loading, googleConnected
   - Mutações: save, archive, sync (preserva API existente do useContacts)
   - Polling/refetch sob demanda
   - Gated por useAuth
2. Mover `src/hooks/useContacts.ts` para virar consumer-only que valida `useContext(ContactsContext)`.
3. Atualizar `src/App.tsx` para incluir `<ContactsProvider>` dentro de `<AuthProvider>` e fora dos componentes que consomem.
4. Verificar que todos os componentes que importam `useContacts` continuam funcionando (não devem mudar import path).

5. ContactPanel — adicionar tier dropdown no header (próximo ao nome): select com opções inner/strong/network/weak/dormant + label "Sem tier". Salva via useContacts.save.

6. ContactPanel — adicionar 3 abas novas (manter as existentes: Geral, Interações):

   **Aba "Carnegie":**
   - Campo `preferred_name` (input)
   - Campo `pronunciation` (input, placeholder "Ex: ma-RÍ-na")
   - Campo `their_goals` (textarea — "O que essa pessoa quer", ref P3)
   - Campo `what_they_value` (textarea — "Como se sente importante", ref P9)
   - Campo `interests` (chips editáveis — array de strings)
   - Campo `conversation_hooks` (lista editável — array de strings, cada item é um hook tipo "Helena entrou em Letras na USP")
   - Campo `family` (form pequeno: spouse, children como lista nome+idade, pets)
   - Botão "Sugerir abertura" → POST `/api/contacts-suggest-message` (vamos criar em PR 5; por enquanto botão pode ficar disabled com tooltip "Em breve")

   **Aba "Datas":**
   - Lista de `special_dates` do contato (`useSpecialDates({ contactId })`)
   - Cada linha: marker visual por tipo (cor borda) + label + data + ações editar/deletar
   - Form inline "+ Adicionar data": label, date (DD/MM ou date full toggle), type select (celebrate/acknowledge/silence/check_in), recurring toggle, lead_days, private_note
   - Hint visual explicando os 4 tipos
   - Datas derivadas automaticamente (de `firstMet` e `companyStartDate` no contato) aparecem marcadas como "derived" e read-only nesta UI

   **Aba "Elogios":**
   - Lista de `compliments_received` do contato (`useCompliments({ contactId })`)
   - Cada item: texto em itálico, data, contexto, badge "Retribuir em ~Xd" ou "Retribuído ✓ (data)"
   - Form inline "+ Registrar elogio": text textarea + context input + botão salvar
   - Botão "Marcar como retribuído" em itens não retribuídos, opens reciprocation_note input

7. Manter design system: classes do globals.css, sem inline color hex, CSS variables. Estética igual aos painéis existentes (TaskPanel, ContactPanel).

8. Testes (vitest):
   - Hooks com mock de api.ts
   - Componentes com render básico

9. **Validação:** `npm test && npm run build`.

Critério de aceite: ContactPanel tem as 3 abas novas funcionando, salvando, lendo dados. Visual coerente. Padrão Provider+consumer aplicado.

Não criar ainda: PulseView, RitualsView, suggest-message endpoint (vão no PR 4 e 5).
```

---

## PR 4 — Subtab Pulso + subtab Rituais

Após PR 3 mergeado, cole:

```
OK, PR 4. Escopo: criar duas novas subtabs em ContatosPage — "Pulso" (landing) e "Rituais". Substituir/absorver Follow-ups na Pulso.

Tarefas:

1. Em `src/pages/ContatosPage.tsx`, atualizar subtabs:
   - Antes: Lista / Pipeline / Follow-ups / Relacionamentos
   - Depois: Pulso / Lista / Pipeline / Rituais / Relacionamentos
   - Persistir aba ativa em localStorage (chave 'contacts:tab')
   - Default: "Pulso" para novos users; manter última escolhida

2. Criar `src/components/contacts/PulseView.tsx`:
   - Banner Princípio do Mês no topo (usa `usePrincipleOfMonth()` → exibe P{N} + título + descrição + barra de progresso applied/target). Lista dos 30 princípios + descrição: criar `src/lib/carnegie.ts` com const `CARNEGIE_PRINCIPLES: Record<string, {title: string, desc: string}>`.
   - Stats row (4 cards): inner em atraso, strong em atraso, promessas atrasadas, streak (computar streak via gratitude_entries + interactions consecutivas — simplificar nesta fase: # de dias consecutivos com >=1 interaction)
     - Inner/strong em atraso: filtrar `contacts` por tier+v_contacts_overdue, contar
     - Promessas atrasadas: tasks com tag '#promessa' + due_at < now() + status not done
   - Strip "Datas especiais esta semana" (chips horizontais): consome `special-dates-upcoming?days=7`. Marker visual por tipo. Click → abre ContactPanel da pessoa.
   - Section "Loops de gratidão a fechar": consome `referrals-pending`. Card com from_contact → to_contact + context + age. Ações: "Fechar loop agora" (registra interaction tipo gratitude + marca referral.feedback_given=true) ou "Pendente".
   - Section "Inner em atraso": cards de contatos com tier=inner e is_overdue. Cada card: avatar, nome, meta (tier + dias), hook (primeiro conversation_hook se houver). 3 botões: WhatsApp (abre wa.me/<phone>), Sugerir (abre modal de sugestão de mensagem — usa endpoint PR 5), Adiar 7d (registra interaction tipo postponed sem ação real).
   - Section "Strong em atraso": idem.
   - Section "Sinais recentes": placeholder; consome contacts com last_signal_at <= 7d (no MVP esse campo é populado manualmente pelo user, não há scraper).

3. Criar `src/components/contacts/RitualsView.tsx`:
   - 4 cards seguindo o protótipo:

     **Card "Thank You Tour"** (trimestral):
     - Cadence pill + "Vence em Xd" (calcular próximo trimestre 1º fev/mai/ago/nov)
     - Lista de pré-selecionados (pré-seleção: contacts com favor_balance > 1 e last interaction nos últimos 90d). Cada linha: checkbox, avatar, nome, "razão" (placeholder por enquanto: "Saldo +N"), badge balance
     - Botão "Começar com os N selecionados" — abre modal de redação assistida (uma pessoa por vez, contagem regressiva 90s pra não terminar rápido)
     - Streak (# de tours feitos historicamente — contar rituals onde >=1 interaction tipo gratitude foi registrada em janela trimestral)

     **Card "Reflexão semanal"** (domingo 19h):
     - Estado: se houver reflection da semana atual (week ISO), mostrar resumo + botão "Editar"; senão, botão "Abrir reflexão"
     - Modal com 3 perguntas (Q1 marked_me, Q2 let_down, Q3 reconnect), cada uma com search de contato (autocomplete via useContacts) + textarea por quê (Q1, Q2)
     - Salvar via `useWeeklyReflections.save`
     - Streak (# de semanas consecutivas com reflexão)

     **Card "Diário de gratidão"** (sexta 18h):
     - Lista das últimas 3 entradas (texto, contact mention, data relativa "sexta passada")
     - Botão "+ Nova entrada" → modal: contact search + textarea max 280 chars + checkbox "Compartilhar com a pessoa"
     - Salvar via `useGratitudeEntries.save`. Se shared=true, abre o canal preferido do contato

     **Card "Princípio do mês"**:
     - Mostra princípio atual (P{N}) + barra progress
     - Botão "Ver os 30 princípios" → modal com lista completa do `CARNEGIE_PRINCIPLES`
     - Histórico (últimos 2-3 meses)

4. Atualizar `src/components/contacts/PipelineView.tsx`: nenhuma mudança nesta fase.
5. Atualizar `src/components/contacts/RelationshipsView.tsx`: nenhuma mudança.
6. `FollowupsView.tsx`: pode permanecer como rota interna ou ser removido (decisão sua, JP — recomendo remover quando Pulso estabilizar).

7. CSS: adicionar classes utilitárias em `src/styles/globals.css` se necessário (chips, ritual-card, pulse-card). Seguir variáveis CSS existentes.

8. Testes básicos (render sem crash).

9. **Validação:** `npm test && npm run build`.

Critério de aceite: Pulso é uma landing completa, navegável, com dados reais. Rituais tem os 4 cards funcionando (Reflexão e Diário salvam dados; Thank You Tour pode ter o modal de redação simplificado nesta fase).

Não criar ainda: endpoint suggest-message (PR 5), crons (PR 5), integração com Briefing (PR 5).
```

---

## PR 5 — Endpoint suggest-message + crons + integração briefing

Após PR 4 mergeado, cole:

```
OK, PR 5. Escopo: criar o endpoint de sugestão de mensagem (Sonnet), adicionar 2 crons (special-dates-cron, rituals-cron), e integrar Carnegie/datas/loops no briefing matinal.

Tarefas:

1. **Endpoint `api/contacts-suggest-message.ts`** (POST):
   - Body: { contactId, intent: 'birthday'|'reconnect'|'congrats_promotion'|'ping_casual'|'special_date'|'thank_you', extraContext?: string }
   - Carrega o contato completo + últimas 5 interactions + special_dates próximas + compliments
   - System prompt: explicação dos 6 princípios Carnegie (P4-P9), e o pedido é "gere 2 ângulos diferentes de abertura de mensagem para essa pessoa, cada um referenciando 1 princípio específico, sem produzir o texto final completo — só a abertura + uma sugestão de continuação"
   - Usar **Sonnet** (claude-sonnet-4-6) via `getAnthropic()`.
   - Response: `{ angles: [{ principle: string, principleLabel: string, openingText: string, suggestedContinuation: string }] }`
   - `parseJsonFromLlm` com fallback
   - `maxDuration = 60`
   - Schema Zod no `_schemas/`
   - Testes do schema

2. Atualizar `ContactPanel.tsx` aba Carnegie e `PulseView.tsx` cards: botão "Sugerir" abre modal usando esse endpoint, mostra os ângulos com botões Copiar e Abrir WhatsApp.

3. **Cron `api/special-dates-cron.ts`** (08:00 BRT diário):
   - `requireCron`
   - `maxDuration = 300`
   - Para cada user: buscar special_dates do dia (date_anniversary = today MM/DD OR date_full = today)
   - Filtrar por type:
     - `celebrate` e `check_in`: enviar email simples (Resend) com lista. Reusar `htmlEscape` e o padrão de email do briefing.
     - `silence`: silenciar todos os triggers da pessoa (no MVP: só log; implementação efetiva é filtragem nas queries de Pulso/Briefing — adicionar TODO).
   - Idempotência: marcar via tabela auxiliar simples ou inferir por last_sent flag no special_date (adicionar coluna `last_celebrated_at timestamptz` se decidir esse caminho — opcional, MVP pode reenviar)
   - Adicionar entry no `vercel.json`: `{ "path": "/api/special-dates-cron", "schedule": "0 11 * * *" }` (08:00 BRT = 11:00 UTC)

4. **Cron `api/rituals-cron.ts`** (múltiplos triggers, rodar a cada 1h):
   - `requireCron`
   - Para cada user, checar hora local (users.timezone):
     - Sexta 18:00 local → email "Diário de gratidão" com link/CTA. Idempotente por (user, date).
     - Domingo 19:00 local → email "Reflexão semanal" com link/CTA. Idempotente.
     - 1ª segunda do mês 08:30 local → email "Princípio do mês" mostrando o P do mês. Se principle_of_month do mês não existir, criar (rotação P1..P30).
     - 1 dia útil dos meses Fev/Mai/Ago/Nov 08:00 local → email "Thank You Tour disponível" com top 5 pré-selecionados.
   - Idempotência via tabela auxiliar `ritual_sent_log (user_id, ritual_kind, sent_for date)` OU via flag em principle_of_month/weekly_reflections (cria registro placeholder no envio do email).
   - vercel.json: `{ "path": "/api/rituals-cron", "schedule": "0 * * * *" }`

5. **Atualizar `api/_briefing-context.ts`** (`fetchAqalContext`):
   - Adicionar ao retorno:
     - `birthdaysToday`: nomes de contatos cujo birthday=today MM/DD
     - `specialDatesToday`: lista de special_dates today com type celebrate/check_in/acknowledge (não silence)
     - `loopsToClose`: count e top 3 referrals pendentes
     - `principleOfMonth`: { principle, title, applied, target }
   - Adicionar tipos correspondentes em domain.ts (se for compartilhado)

6. **Atualizar `api/_briefing.ts`** (template HTML):
   - Adicionar seção "Datas hoje" se houver birthdays ou special_dates
   - Adicionar seção "Princípio do mês" no topo (compacto)
   - Adicionar "Loops pendentes" se houver
   - Tudo opcional: se vazio, omitir seção

7. Testes:
   - Schema suggest-message
   - Lógica de seleção de tour (pre-selecionados)
   - Lógica de rotação do principle of month

8. **Validação:** `npm test && npm run build && vercel build` (este último pra validar crons no vercel.json).

Critério de aceite: briefing matinal traz informação nova quando há datas/loops/princípio. Sugestão de mensagem funciona. Crons rodam sem erro (testar local com `npm run dev:api` + chamada manual com header CRON_SECRET).
```

---

## PR 6 (opcional / pode ficar pra depois) — Health score + Dunbar

Cole apenas se quiser fechar a v1 completa antes de testar com uso real:

```
OK, PR 6 (opcional). Escopo: view v_contact_health (Maister) + página/subtab Rede com Dunbar dashboard.

Tarefas:

1. Migration 0016: criar view `v_contact_health`:
   - credibility = baseline 5 + (# interactions tipo 'meeting'/'call' nos últimos 12m * 0.5, max +5)
   - reliability = (% de tasks com tag '#promessa' relacionadas ao contato que estão done)
   - intimacy = baseline 1 + (count de conversation_hooks + count de family items, max 10)
   - self_orientation = 1.0 baseline; -0.2 se favor_balance > 0; +0.3 se favor_balance < -2
   - score = round((credibility + reliability + intimacy) / self_orientation * 5)
   - Materializada? Por hora, view normal recomputada por contato. Caching no front via hook.

2. Endpoint `api/contacts-network-stats.ts`:
   - Retorna Dunbar buckets (inner/close/strong/stable) com counts atuais e limits (5/15/50/150)
   - Top 6-10 contatos por health_score

3. Subtab "Rede" (substituir ou complementar RelationshipsView):
   - Dunbar grid com barras de progresso por tier (counts vs limits)
   - Health cards grid (top 6) com score colorido (>= 80 verde, 60-79 amarelo, < 60 vermelho)

4. **Validação:** `npm test && npm run build`.

Critério de aceite: dashboard de rede dá visão macro da saúde dos relacionamentos. Health score reflete realidade.
```

---

## Checklist final pós-todos-os-PRs

Quando todos os PRs forem mergeados:

```
Atualize SPEC.md:
- §3 (Mapa): atualizar linha de Contacts mencionando special_dates, referrals, compliments, rituais
- §7 (Data model): documentar as novas tabelas e campos
- §9.8: ampliar com novos endpoints, hooks, componentes
- §12 (Débitos): adicionar "Carnegie v2 / parking lot" com itens fora do escopo desta fase

Atualize CLAUDE.md:
- Estrutura de pastas: adicionar arquivos novos
- Comandos: nenhuma mudança

Atualize REVIEW.md:
- Mover "BirthdaysStrip" de débito para resolvido (especial_dates_today substitui)
- Adicionar parking lot Carnegie v2

Rode `npm test`, `npm run build`, e me reporte que está pronto para uso.
```

---

## Dicas operacionais

1. **Espere cada PR fechar antes do próximo.** Se o Claude Code se atropela, peça pra ele parar e revisar.
2. **Se algo destoar do CLAUDE.md, corte fora.** O CLAUDE.md é a fonte de verdade do estilo do código.
3. **Não aplique as migrations em produção até testar local.** `supabase db reset` local é seu amigo.
4. **Verifique o vercel.json após PR 5.** Os crons novos têm que respeitar fuso (BRT = UTC-3).
5. **Se o Provider refactor (PR 3) gerar regressão**, pode ser que o Coach esteja consumindo useContacts internamente — verifique antes de fechar.
6. **Os PRs 4 e 5 podem ser feitos em paralelo** se você tiver dois branches separados (Pulso é frontend puro, Crons é backend puro). Mas recomendo sequencial pra evitar conflito.

---

*Fim do pacote. Boa implementação.*
