# JP App — Módulo Hill · Spec Técnico

> Extensão do JP App existente. Reusa stack atual: Next.js (Vite + React + Vercel Functions), Supabase (Postgres), Vercel Cron, Resend, Anthropic API. Não introduz novas dependências de infra.

---

## 1. Visão geral do módulo

O **Módulo Hill** adiciona ao JP App:
- Sistema de Chief Aim com Goals em 3 níveis (Dream / Goal / Quarterly)
- 5 Affirmations versionadas por trimestre, com dados de uso
- Rituais matinal e noturno com logs detalhados
- Coach Hill (LLM persistente, 4 modos)
- Mastermind virtual (Invisible Counselors)
- Revisão trimestral guiada

---

## 2. Schema do banco · Postgres / Supabase

Todas as tabelas têm `id uuid pk default uuid_generate_v4()`, `user_id uuid fk → users(id)`, `created_at`, `updated_at`. Omitido abaixo por brevidade.

### 2.1 `chief_aims`

```sql
create table chief_aims (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id) on delete cascade,
  aim_text      text not null,                    -- o aim completo, formato Hill
  deadline      date not null,
  exchange_text text not null,                    -- "o que estou disposto a dar em troca"
  plan_text     text,                             -- plano definido (markdown ok)
  is_active     boolean not null default true,    -- só 1 active por user
  archived_at   timestamptz,
  next_review   date not null,                    -- date_trunc('day', created_at + interval '90 days')
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- só 1 chief_aim ativo por usuário
create unique index chief_aims_user_active
  on chief_aims(user_id) where is_active = true;

create index chief_aims_user_id on chief_aims(user_id);
create index chief_aims_next_review on chief_aims(next_review) where is_active = true;
```

**Notas:**
- O Chief Aim é versionado por archive (não há UPDATE no texto principal). Mudou? Cria um novo, arquiva o antigo. Mantém histórico.
- `next_review` é a data da próxima revisão trimestral — usado pelo cron.

---

### 2.2 `goals`

```sql
create type goal_level as enum ('dream', 'goal', 'quarterly');
create type goal_status as enum ('active', 'completed', 'archived', 'failed');

create table goals (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id),
  chief_aim_id  uuid references chief_aims(id),    -- null para Dream
  parent_id     uuid references goals(id),          -- hierarquia: quarterly.parent = goal.id, goal.parent = dream.id
  level         goal_level not null,
  title         text not null,
  metric_text   text,                                -- "10k usuários pagantes"
  metric_value  numeric,                             -- 10000
  metric_unit   text,                                -- "usuários"
  progress_pct  numeric default 0,                   -- 0-100, atualizado manualmente
  deadline      date,
  status        goal_status not null default 'active',
  linked_project_id uuid references projects(id),    -- liga ao Project existente do JP App
  completed_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index goals_user_active on goals(user_id, status) where status = 'active';
create index goals_parent on goals(parent_id);
create index goals_chief_aim on goals(chief_aim_id);
```

**Notas:**
- Vinculação opcional a `projects` existentes (`linked_project_id`) — permite que "tasks com propósito" do briefing apareçam.
- `parent_id` é self-referential para a hierarquia Dream → Goal → Quarterly.

---

### 2.3 `affirmations`

```sql
create type affirmation_dimension as enum ('identidade', 'acao', 'capacidade', 'relacoes', 'integracao');
create type affirmation_status as enum ('active', 'retired', 'superseded');

create table affirmations (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references users(id),
  chief_aim_id      uuid not null references chief_aims(id),
  dimension         affirmation_dimension not null,
  text              text not null,
  belief_score      smallint not null check (belief_score between 1 and 5),
  derived_from      jsonb,                              -- { evidences: [goal_id, goal_id] } se foi derivada
  status            affirmation_status not null default 'active',
  superseded_by     uuid references affirmations(id),   -- aponta para a nova versão
  retired_reason    text,                               -- "cumpriu", "não encaixou", etc.
  active_from       date not null default current_date,
  active_until      date,                               -- preenchido quando muda
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- só 1 affirmation ativa por dimensão por usuário
create unique index affirmations_user_dim_active
  on affirmations(user_id, dimension)
  where status = 'active';

create index affirmations_user on affirmations(user_id);
create index affirmations_chief_aim on affirmations(chief_aim_id);
```

**Notas:**
- Versionamento por `superseded_by` + `retired_reason` permite reconstruir histórico completo (importante para análise + insights de revisão trimestral).
- `derived_from` é jsonb para afirmações de Capacidade que foram extraídas de evidências (referencia goals.id).

---

### 2.4 `ritual_logs`

```sql
create type ritual_type as enum ('morning', 'night');

create table ritual_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id),
  type            ritual_type not null,
  started_at      timestamptz not null,
  completed_at    timestamptz,                         -- null se pausou
  duration_seconds int,                                -- preenchido quando completed
  steps_completed jsonb not null default '[]',         -- ["chief_aim_read", "visualization", "affirmations", ...]
  affirmations_read uuid[] default '{}',               -- array de affirmation.id que foram lidas
  affirmations_skipped uuid[] default '{}',
  reflection_data jsonb,                               -- { what_brought_closer: "...", what_pushed_away: "...", next_action: "..." }
  gratitude_items text[],                              -- ["pela energia...", "pela mensagem..."]
  daily_action_task_id uuid references tasks(id),      -- task criada no passo 3 do ritual matinal
  created_at      timestamptz default now()
);

create index ritual_logs_user_type on ritual_logs(user_id, type);
create index ritual_logs_completed on ritual_logs(user_id, completed_at) where completed_at is not null;
create index ritual_logs_started_at on ritual_logs(started_at desc);
```

**Notas:**
- Logs detalhados permitem cálculo de aderência, streaks, padrões de skip.
- `daily_action_task_id` cria ponte com sistema de Tasks existente.

---

### 2.5 `coach_messages`

```sql
create type coach_mode as enum ('chat', 'ritual_murmur', 'wizard_step', 'daily_nudge');
create type message_role as enum ('user', 'coach');

create table coach_messages (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id),
  conversation_id uuid not null,                      -- agrupa turns; ritual_murmur/daily_nudge têm conv_id próprio efêmero
  mode            coach_mode not null,
  role            message_role not null,
  content         text not null,
  context_used    jsonb,                              -- snapshot do user_context enviado (debug + futuras análises)
  tokens_in       int,
  tokens_out      int,
  model           text,
  cost            numeric(10,6),
  action_payload  jsonb,                              -- se output continha <action>
  user_action_taken boolean,                          -- se usuário aceitou a action
  created_at      timestamptz default now()
);

create index coach_messages_user on coach_messages(user_id, created_at desc);
create index coach_messages_conversation on coach_messages(conversation_id);
create index coach_messages_mode on coach_messages(user_id, mode, created_at desc);
```

**Notas:**
- `conversation_id` permite agrupar turns de chat. Para `daily_nudge` e `ritual_murmur`, cada mensagem tem conv_id próprio (são one-shots).
- `context_used` armazena snapshot — útil para debug e para evitar repetir nudges similares.

---

### 2.6 `quarterly_reviews`

```sql
create table quarterly_reviews (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id),
  chief_aim_id        uuid not null references chief_aims(id),
  triggered_at        timestamptz not null default now(),
  completed_at        timestamptz,
  aim_decision        text,                          -- "kept", "adjusted", "rewritten"
  affirmation_decisions jsonb,                       -- [{ aff_id, decision: "kept"|"refined"|"replaced"|"retired", new_aff_id?, reason? }]
  ritual_stats        jsonb,                          -- snapshot dos stats no momento da revisão
  next_review_date    date not null,
  exported_pdf_url    text,                           -- se usuário exportou
  created_at          timestamptz default now()
);

create index quarterly_reviews_user on quarterly_reviews(user_id, triggered_at desc);
```

---

### 2.7 `mastermind_counselors`

```sql
create table mastermind_counselors (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id),
  name            text not null,
  short_label     text not null,                     -- "SJ", "WB" — para avatar
  archetype       text not null,                     -- "Produto · Foco"
  is_real_person  boolean not null default false,    -- pessoa real vs histórica
  context_prompt  text,                               -- como esta voz pensa, fala, decide
  is_active       boolean not null default true,
  display_order   smallint default 0,
  created_at      timestamptz default now()
);

create index mastermind_counselors_user on mastermind_counselors(user_id, is_active);
```

### 2.8 `mastermind_sessions`

```sql
create table mastermind_sessions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id),
  question        text not null,                     -- a pauta da reunião
  counselor_responses jsonb not null,                -- [{ counselor_id, response }]
  user_decision   text,                              -- decisão tomada após ouvir
  decision_reason text,
  held_at         timestamptz not null default now(),
  created_at      timestamptz default now()
);

create index mastermind_sessions_user on mastermind_sessions(user_id, held_at desc);
```

---

## 3. APIs internas · endpoints

Seguem padrão REST-ish do JP App existente: response shape `{ data, error }`, auth via cookie Supabase.

### 3.1 Chief Aim

```
GET    /api/hill/chief-aim                      # retorna o ativo
POST   /api/hill/chief-aim                      # cria novo (arquiva o anterior)
PATCH  /api/hill/chief-aim/:id                  # só meta (plan_text, exchange_text); aim_text é imutável
GET    /api/hill/chief-aim/history              # lista todos os archived
```

### 3.2 Goals

```
GET    /api/hill/goals?level=&status=
POST   /api/hill/goals
PATCH  /api/hill/goals/:id
DELETE /api/hill/goals/:id
PATCH  /api/hill/goals/:id/progress             # atualiza só progress_pct
POST   /api/hill/goals/:id/complete             # marca completed_at + status
```

### 3.3 Affirmations

```
GET    /api/hill/affirmations                   # lista as 5 ativas
POST   /api/hill/affirmations                   # cria nova (uso no wizard)
PATCH  /api/hill/affirmations/:id               # refina (cria nova com superseded_by)
DELETE /api/hill/affirmations/:id               # retire (não deleta de fato; muda status)
GET    /api/hill/affirmations/usage-stats       # stats agregadas para a revisão
POST   /api/hill/affirmations/wizard            # POST de uma sessão inteira do wizard
```

### 3.4 Rituals

```
POST   /api/hill/rituals/start                  # cria ritual_log com started_at
PATCH  /api/hill/rituals/:id/step               # adiciona step a steps_completed
PATCH  /api/hill/rituals/:id/complete           # marca completed_at + duration
GET    /api/hill/rituals/stats?days=30          # aderência, streaks
GET    /api/hill/rituals/history?from=&to=
```

### 3.5 Coach

```
POST   /api/hill/coach/chat                     # POST { message, conversation_id? }
POST   /api/hill/coach/wizard-step              # POST { dimension, draft, mode }
POST   /api/hill/coach/mastermind-session       # POST { question } → gera respostas
GET    /api/hill/coach/conversations            # lista conversation_ids do usuário
GET    /api/hill/coach/conversations/:id        # mensagens de uma conversa
```

### 3.6 Quarterly Review

```
GET    /api/hill/review/pending                 # retorna se está na hora (data >= next_review)
POST   /api/hill/review/start                   # cria quarterly_reviews row
PATCH  /api/hill/review/:id/aim-decision        # salva decisão do Aim
PATCH  /api/hill/review/:id/affirmation         # salva decisão de uma affirmation
PATCH  /api/hill/review/:id/complete            # finaliza e atualiza next_review nos chief_aims
POST   /api/hill/review/:id/export-pdf          # gera + retorna URL
```

---

## 4. Fluxo do Coach · função central

A função `generateCoachMessage()` centraliza a chamada ao LLM. Vive em `lib/hill/coach.ts`.

```typescript
// lib/hill/coach.ts

import Anthropic from '@anthropic-ai/sdk'
import { getSupabase } from '@/api/_supabase'
import { COACH_HILL_SYSTEM_PROMPT } from './prompts/coach-hill'

interface CoachInput {
  userId: string
  mode: 'chat' | 'ritual_murmur' | 'wizard_step' | 'daily_nudge'
  message?: string                    // user message (chat)
  conversationId?: string             // chat continuity
  dimension?: string                  // wizard
  draft?: string                      // wizard
  trigger?: string                    // daily_nudge trigger
  contextOverride?: any               // ritual_murmur context
}

interface CoachOutput {
  content: string
  action?: { type: string; payload: any }
  conversationId: string
  cost: number
}

const MODELS = {
  chat: 'claude-sonnet-4-5',
  wizard_step: 'claude-sonnet-4-5',
  ritual_murmur: 'claude-haiku-4-5-20251001',   // mais barato, prompt curto
  daily_nudge: 'claude-haiku-4-5-20251001'
}

const MAX_TOKENS = {
  chat: 800,
  wizard_step: 600,
  ritual_murmur: 80,
  daily_nudge: 200
}

export async function generateCoachMessage(input: CoachInput): Promise<CoachOutput> {
  const supabase = getSupabase()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // 1. Build user_context block
  const userContext = await buildUserContext(input.userId, input.mode)

  // 2. Build user message based on mode
  const userMessage = buildUserMessage(input, userContext)

  // 3. Get conversation history (chat mode only)
  const history = input.mode === 'chat' && input.conversationId
    ? await getConversationHistory(input.conversationId)
    : []

  // 4. Call Anthropic
  const response = await anthropic.messages.create({
    model: MODELS[input.mode],
    max_tokens: MAX_TOKENS[input.mode],
    system: COACH_HILL_SYSTEM_PROMPT,
    messages: [
      ...history,
      { role: 'user', content: userMessage }
    ]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // 5. Parse optional <action> tag
  const action = parseActionTag(text)
  const cleanContent = text.replace(/<action[^>]*\/>/g, '').trim()

  // 6. Persist
  const conversationId = input.conversationId ?? crypto.randomUUID()
  await persistCoachMessage({
    userId: input.userId,
    conversationId,
    mode: input.mode,
    content: cleanContent,
    contextUsed: userContext,
    tokensIn: response.usage.input_tokens,
    tokensOut: response.usage.output_tokens,
    model: MODELS[input.mode],
    actionPayload: action
  })

  return {
    content: cleanContent,
    action,
    conversationId,
    cost: calculateCost(MODELS[input.mode], response.usage)
  }
}

async function buildUserContext(userId: string, mode: string) {
  // Fetch in parallel — não bloquear
  const [chiefAim, affirmations, goals, ritualStats, recentTasks, recentNudges] =
    await Promise.allSettled([
      getActiveChiefAim(userId),
      getActiveAffirmations(userId),
      getActiveGoals(userId),
      getRitualStats(userId, 30),
      getRecentTasksWithAim(userId, 5),
      mode === 'daily_nudge' ? getRecentNudges(userId, 7) : null
    ])

  return serializeContextAsXML({
    chiefAim, affirmations, goals, ritualStats, recentTasks, recentNudges
  })
}

function buildUserMessage(input: CoachInput, context: string): string {
  // Templates por modo, sempre com <mode> tag e <user_context>
  switch (input.mode) {
    case 'chat':
      return `<mode>chat</mode>\n<user_context>${context}</user_context>\n\n${input.message}`
    case 'wizard_step':
      return `<mode>wizard_step</mode>\n<dimension>${input.dimension}</dimension>\n<draft>${input.draft}</draft>\n<user_context>${context}</user_context>`
    case 'ritual_murmur':
      return `<mode>ritual_murmur</mode>\n<context>${input.contextOverride}</context>`
    case 'daily_nudge':
      return `<mode>daily_nudge</mode>\n<trigger>${input.trigger}</trigger>\n<user_context>${context}</user_context>`
  }
}

function parseActionTag(text: string): { type: string; payload: any } | undefined {
  const match = text.match(/<action\s+type="([^"]+)"\s+payload='([^']+)'\/>/)
  if (!match) return undefined
  try {
    return { type: match[1], payload: JSON.parse(match[2]) }
  } catch {
    return undefined
  }
}
```

---

## 5. Cron jobs · Vercel

Adicionar ao `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/hill/cron/morning-push",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/hill/cron/night-push",
      "schedule": "0 22 * * *"
    },
    {
      "path": "/api/hill/cron/daily-nudge",
      "schedule": "30 7 * * *"
    },
    {
      "path": "/api/hill/cron/check-quarterly-reviews",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### 5.1 `morning-push` (9h)
Envia push notification para usuários ativos: "Ritual matinal te espera". Não envia se já tem `ritual_log` matinal com `started_at >= today 00:00`.

### 5.2 `night-push` (22h)
Mesmo padrão para ritual noturno.

### 5.3 `daily-nudge` (7h30)
Roda heurística sobre cada usuário para detectar gatilhos:
- Task adiada > 3 dias + linked_aim → nudge sobre procrastinação
- Affirmation com skip > 30% nos últimos 14 dias → nudge sugerindo revisão
- Goal Q com progress < 30% a 21 dias do prazo → nudge estratégico
- Streak quebrada após >7 dias consecutivos → nudge de retomada

Se gatilho dispara E não há nudge similar nos `recent_nudges` (7 dias), chama `generateCoachMessage(mode: 'daily_nudge')` e envia.

### 5.4 `check-quarterly-reviews` (segundas 9h)
Para cada `chief_aims.is_active = true`, verifica `next_review <= today + 3 days`. Se sim, envia notificação convidando para a revisão.

---

## 6. Sistema de notificações

Reusa a tabela `notifications` que já existe no JP App:

```sql
-- adicionar enum values existentes
alter type notification_type add value 'hill_morning_ritual';
alter type notification_type add value 'hill_night_ritual';
alter type notification_type add value 'hill_daily_nudge';
alter type notification_type add value 'hill_quarterly_review';
alter type notification_type add value 'hill_coach_message';
```

Polling existente (60s no hook `useNotifications`) já cobre. Cada notification tem `link_to` que abre tela correspondente.

---

## 7. Integração com Briefing existente

O briefing matinal (`/api/briefing/cron` às 09:30 UTC) ganha 2 campos novos no JSON gerado pelo Claude Haiku:

```typescript
// Adicionar ao prompt de curadoria:
const curationPromptAddendum = `
Além das categorias normais, inclua:

- "affirmation_of_day": uma das 5 afirmações do usuário, sorteada (rotação diária)
- "hill_nudge": se existe nudge ativo do dia, incluir aqui. Caso contrário null.

A afirmação aparece no topo do briefing. O nudge aparece logo abaixo.
`

// JSON estrutura:
{
  "highlight": "...",
  "affirmation_of_day": "...",        // novo
  "hill_nudge": "..." | null,         // novo
  "global": [...],
  "brasil": [...],
  "newsletters": [...]
}
```

Front renderiza `affirmation_of_day` como o `affirm-card` verde-âmbar do mockup, e `hill_nudge` como o card preto com voz do Hill.

---

## 8. Fluxo do Wizard de Afirmações

### 8.1 State machine

```
welcome → tests_explained → comparison → 
  dim_identidade → dim_acao → 
    [PAUSE 24h enforced] → 
  dim_capacidade (evidence picker → derived suggestion → edit) → 
    [PAUSE 24h enforced] → 
  dim_relacoes → dim_integracao → 
  final_review → seal
```

### 8.2 Persistência incremental

Cada passo do wizard persiste em `affirmations` com status temporário. O `seal` final muda todas para `status = 'active'` atomicamente.

```sql
create type wizard_step as enum (
  'welcome', 'tests', 'comparison',
  'identidade', 'acao', 'capacidade', 'relacoes', 'integracao',
  'review', 'sealed'
);

create table wizard_state (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references users(id),
  chief_aim_id  uuid not null references chief_aims(id),
  current_step  wizard_step not null default 'welcome',
  session_data  jsonb default '{}',                 -- drafts, evidences chosen, etc.
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  pause_until   timestamptz,                        -- enforce 24h pause
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create unique index wizard_state_user_active
  on wizard_state(user_id) where completed_at is null;
```

### 8.3 Enforcement da pausa 24h

```typescript
// /api/hill/wizard/can-continue
export async function GET(req: Request) {
  const state = await getActiveWizardState(userId)
  if (!state.pause_until) return Response.json({ can_continue: true })
  
  const now = new Date()
  if (now < new Date(state.pause_until)) {
    const hoursLeft = Math.ceil((new Date(state.pause_until).getTime() - now.getTime()) / 3600000)
    return Response.json({ 
      can_continue: false, 
      hours_remaining: hoursLeft,
      override_available: true  // tela permite forçar mas alerta
    })
  }
  return Response.json({ can_continue: true })
}
```

---

## 9. Variáveis de ambiente

Adicionar ao `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...           # já existe; reutiliza
COACH_MODEL_PRIMARY=claude-sonnet-4-5
COACH_MODEL_LIGHT=claude-haiku-4-5-20251001
HILL_DAILY_NUDGE_ENABLED=true          # feature flag
HILL_WIZARD_PAUSE_HOURS=24              # configurável; default 24
```

---

## 10. Migration order (para implementação)

1. Criar `chief_aims`, `goals`, `affirmations`
2. Criar `ritual_logs`, `coach_messages`
3. Criar `quarterly_reviews`, `mastermind_counselors`, `mastermind_sessions`, `wizard_state`
4. Adicionar valores ao enum `notification_type`
5. Implementar `lib/hill/coach.ts` com `generateCoachMessage`
6. Implementar endpoints `/api/hill/chief-aim/*` e `/api/hill/affirmations/*`
7. Construir telas: Compass, Wizard, Ritual Manhã, Ritual Noite
8. Implementar endpoints de Coach, Rituals, Mastermind
9. Construir telas: Coach Chat, Mastermind, Briefing integrado
10. Implementar cron jobs
11. Implementar Revisão Trimestral

---

## 11. Estimativa de custo · LLM

Considerando 1 usuário ativo médio (Jorge):

| Modo | Frequência | Tokens in | Tokens out | Modelo | Custo/uso |
|------|-----------|-----------|------------|--------|-----------|
| `ritual_murmur` | 2× dia | 200 | 50 | Haiku | ~$0.0001 |
| `daily_nudge` | 1× dia | 800 | 150 | Haiku | ~$0.0003 |
| `chat` | ~3× semana | 1200 | 400 | Sonnet | ~$0.005 |
| `wizard_step` | só onboarding + Q reviews | 1000 | 300 | Sonnet | ~$0.004 |

**Custo mensal estimado por usuário ativo:** ~$0.50-$0.80

---

## 12. Considerações de RLS (Row-Level Security)

Padrão JP App: todas as tabelas têm policies ensuring `auth.uid() = user_id`.

```sql
alter table chief_aims enable row level security;
create policy "users see own chief_aims" on chief_aims
  for all using (auth.uid() = user_id);

-- repetir para todas as tabelas hill_*
```

Apenas backend (service_role) faz cross-user reads para crons.

---

## 13. O que NÃO está no escopo desta v1

- Áudio guiado nos rituais (visualização passo 4)
- Sincronização com Apple Health / sono (para sugerir horário de ritual noturno)
- Sharing de afirmações entre usuários (compartilhamento de manifestos)
- Multi-idioma (v1 é português-BR only)
- Histórico exportável em CSV
- Dashboard analítico complexo (só stats simples de aderência)

---

## 14. Riscos técnicos identificados

**Risco 1: latência do Coach no chat**
Sonnet pode demorar 3-8s. Mitigar com streaming SSE no front (Anthropic SDK suporta).

**Risco 2: custo escalando com base de usuários**
A 1000 usuários ativos: $500-$800/mês em LLM. Aceitável. A 10k: $5k-$8k/mês. Considerar caching agressivo de daily_nudges e tier de free com nudges desabilitados.

**Risco 3: falsos positivos em daily_nudge**
Heurísticas podem disparar nudges irrelevantes. Mitigar com:
- Confidence threshold por gatilho
- Botão "Esse nudge não fez sentido" → reduz peso do gatilho
- Limite máximo de 1 nudge por dia

**Risco 4: wizard incompleto abandonado**
Se usuário inicia wizard e nunca termina, ele fica sem affirmations ativas e o ritual noturno trava no passo 3. Solução: ritual noturno fallback (gratidão + visualização + selo) quando affirmations.count == 0.

**Risco 5: Coach saindo do personagem**
LLM pode quebrar tom ou contradizer hard rules. Mitigar com:
- Avaliação periódica de samples (1× mês, manual)
- Reportar quebras via botão thumbs-down
- A/B test versões do system prompt antes de promover

---
