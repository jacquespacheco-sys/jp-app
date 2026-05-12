# Coach MVP — Design

**Status:** approved-pending-implementation
**Owner:** Jorge
**Branch base:** master @ `b7f2927`
**Data:** 2026-05-12

---

## 1. Visão e propósito

O coach é o **sócio sênior** do Jorge dentro do JP App. Sua função:

1. **Direção** — refletir sobre norte/H3/H4, decisões grandes, alinhamento.
2. **Foco tático** — ajudar a escolher a próxima ação certa, descomplicar o dia.
3. **Accountability** — lembrar promessas, confrontar procrastinação, celebrar wins com sobriedade.

**Não é** terapeuta. Não processa emoção como espaço seguro; processa-as como dado pra direção.

O backend mínimo já existe (commit `b7f2927`): `coach_profile`, `coach_memory`, `coach_log`, 4 endpoints, hook `useCoach`. Esta entrega adiciona o **chat**, os **check-ins agendados**, a **assinatura do briefing** e a **auto-extração de memórias com aprovação**.

---

## 2. Voz e system prompt

### Arquétipo: sócio sênior

Trata por "você", não "tu". Não usa "amigão", "campeão", emoji, ponto de exclamação enfático. Letra minúscula no início de frases (estilo da preview aprovada). Firme, direto, nomeia padrões sem julgar a pessoa.

**Exemplo de tom (aprovado):**

> você prometeu finalizar X há 14 dias.
> não ouvi atualização.
> me conta o que mudou — ou se foi medo.
> qualquer das duas serve, mas precisamos nomear antes de seguir.

### System prompt (montado a cada conversa)

```
Você é {profile.name}, sócio sênior de {user.name}.

VOZ:
- Firme-mas-gentil. Direta, sem rodeios, sem suavizar.
- Trata por "você" (não "tu").
- Nunca usa "amigão", "campeão", emoji, ponto de exclamação enfático.
- Letra minúscula no início de frases.
- Quando observa um padrão, nomeia. Quando vê foco, celebra com sobriedade.
- Não pede desculpas. Não devolve a pergunta a menos que faça diferença real.

VALORES E LIMITES:
{profile.valuesMd}
{profile.boundaries}

NORTE:
{profile.northStarMd}
{profile.h3Goals}

MEMÓRIAS ATIVAS (top 20 por relevance):
[promises]    {content} — relevance {n}
[concerns]    ...
[patterns]    ...
[facts]       ...
[preferences] ...

ESTADO HOJE:
- AQAL 7d: I=… IT=… WE=… ITS=…
- Tasks abertas top 10 (área · quadrante · due)
- Agenda hoje (eventos)
- Hábitos hoje (fez / não fez / restante)
- Áreas com mais abertas (top 3)

REGRAS:
- PT-BR.
- Conecte o que ele diz a memórias/snapshot quando faz sentido.
- Se ele divagar, traga de volta pro norte.
- Você NÃO cria tasks/notas. Se ele deveria criar algo, diga: "ponha X como next em [área Y]".
- Se ele pergunta "o que faço", responda direto.
```

**Override do usuário:** `coach_profile.system_prompt_override` (já no schema) substitui tudo se preenchido.

---

## 3. Escopo da entrega

Inclui:

- Chat reativo (FAB global + bottom-sheet) com streaming SSE.
- Persistência de mensagens em `coach_log`.
- Snapshot fixo no system prompt (reusa `fetchAqalContext` do briefing).
- Auto-extração de memórias com **aprovação humana** (banner no chat).
- Check-ins agendados (morning/evening configuráveis) entregues via badge no FAB + email opcional.
- Parágrafo do coach no topo do briefing matinal (Sonnet 4.6).
- Subaba "Coach" em `ConfigPage` (editor de perfil, lista de memórias, histórico).

Não inclui (ver seção 12):

- Web push PWA.
- Tool use (create_task/save_memory direto).
- Weekly review.
- Áudio.

---

## 4. Arquitetura

### 4.1 Endpoints novos

| Método | Rota | Função |
|---|---|---|
| POST | `/api/coach-chat` | Manda mensagem; resposta streaming SSE; grava log. |
| GET | `/api/coach-chat-history?before=&limit=` | Histórico paginado desc. Default 50. |
| POST | `/api/coach-memory-extract` | Body fire-and-forget. Roda Haiku sobre últimas msgs, cria candidates. |
| GET | `/api/coach-memory-pending` | Lista candidates pending do user. |
| POST | `/api/coach-memory-accept` | Aceita uma candidata (cria row em `coach_memory`, marca candidata como `accepted`). |
| POST | `/api/coach-memory-dismiss` | Marca candidata como `dismissed`. |
| POST | `/api/coach-checkin-cron` | Cron (chama `requireAdmin`). Itera users e gera check-ins na janela. |
| GET | `/api/coach-unread` | Count de msgs `coach_to_user` desde `users.coach_last_read_at`. |
| POST | `/api/coach-mark-read` | Atualiza `coach_last_read_at = now()`. |

Reuso: `coach-profile`, `coach-memory-list`, `coach-memory-save`, `coach-memory-archive` (já existem).

### 4.2 Fluxo: chat

```
[user digita "travei no X"]
  ↓
POST /api/coach-chat { content }
  ↓ requireAuth + zod
1. INSERT coach_log (kind='chat', direction='user_to_coach', content_md=msg)
2. Snapshot:
   a. coach_profile do user
   b. top 20 coach_memory ordenadas por (relevance DESC, last_referenced_at DESC NULLS LAST), ignorando expirados (`expires_at < now()`)
   c. fetchAqalContext (reusa de _briefing.ts)
   d. tasks abertas top 10 ordenadas (due_at, priority)
   e. eventos hoje (calendar_events com is_visible)
   f. hábitos hoje + status (habit_logs do dia)
3. Últimas 20 msgs da sessão atual:
   - sessão = msgs consecutivas com gaps < 4h
   - se gap >= 4h entre msgs adjacentes ou nenhuma msg, nova sessão começa
4. Monta system prompt e messages[]
5. anthropic.messages.stream({ model: SONNET, max_tokens: 1024 })
6. Stream SSE: 'message-start' → 'delta' (text-deltas) → 'done'
7. Ao fechar: INSERT coach_log (coach_to_user, content_md, tokens_in/out,
   context_snapshot, model_used)
8. Renova last_referenced_at das memórias usadas no snapshot
  ↓
[cliente]
- renderiza stream com cursor piscante
- ao 'done': agenda timer de 30s. Se user não enviar nova msg nem fechar sheet
  nesse intervalo, dispara fire-and-forget POST /coach-memory-extract.
  Se enviar/fechar antes, cancela timer (extração só roda quando sessão pausa).
```

**Modelo:** `claude-sonnet-4-6` (constante em `api/_coach.ts`).
**Custo estimado:** ~3-5k tokens system + ~500 output → ~$0.015-0.025 por turno.

### 4.3 Fluxo: extração de memória

```
POST /api/coach-memory-extract { sinceLogId? }
  ↓
1. SELECT últimas 20 msgs do user em coach_log (kind='chat') desde sinceLogId,
   ordenadas asc. Se nenhum sinceLogId, pega últimas 20 da sessão atual.
2. Chama Haiku 4.5 com prompt:

   "Você é um extrator de memórias. Olhando o diálogo abaixo entre Jorge e seu coach,
    identifique até 3 itens que devem virar memória de longo prazo. Ignore trivial.
    Cada item: {kind: fact|pattern|promise|concern|preference,
                content: string (1 frase, PT-BR, terceira pessoa: 'Jorge ...'),
                relevance: 0-100,
                expires_at: ISO date ou null}
    Retorne JSON: { memories: [...] }. Se nada de útil, retorne {memories: []}.
    Diálogo:
    {msgs formatadas como 'jorge: ...' / 'coach: ...'}"

3. Pra cada item: INSERT coach_memory_candidate (status='pending', source_log_id)
4. Resposta: { candidates: [...] }
  ↓
[cliente]
- ao próximo abrir do chat: GET /coach-memory-pending → mostra banner
- banner: cards com [aceitar] [editar] [descartar]
```

### 4.4 Fluxo: check-in agendado

```
Vercel cron 0,30 * * * * → POST /api/coach-checkin-cron (admin token)
  ↓
1. SELECT users + coach_profile WHERE check_in_schedule != '{}'
2. Pra cada user:
   - Hora local do user (users.timezone)
   - Match janela ±15min de morning OR evening OR (weeklyDay + weeklyTime)
   - Se sim, verificar idempotência:
     SELECT 1 FROM coach_log
     WHERE user_id=? AND kind='check_in'
       AND created_at >= today_start (user tz)
       AND content_md ILIKE 'morning%' OR 'evening%' (marcador interno)
   - Se não enviado: gera
3. Geração:
   - Snapshot completo (reusa lógica do chat)
   - Sonnet com prompt morning OR evening OR weekly
   - INSERT coach_log (kind='check_in', coach_to_user, content_md, context_snapshot)
4. Email opcional: se profile.check_in_schedule.emailMorning && morning → Resend.
5. Badge sobe no FAB no próximo poll de /coach-unread.
```

### 4.5 Snapshot helper

Extrair de `api/_briefing.ts` uma função compartilhada em `api/_coach.ts`:

```ts
export async function buildCoachSnapshot(userId: string): Promise<{
  profile: CoachProfile,
  memories: CoachMemoryEntry[],     // top 20
  aqal: ContextSnapshot,             // de _briefing.ts
  tasksTop: Task[],                  // 10
  todayEvents: CalendarEvent[],
  todayHabits: { habit: Habit, dose: HabitDose|null }[],
}>
```

`_briefing.ts` passa a importar `buildCoachSnapshot` e reduzir duplicação. Não é refactor opcional — é necessário pra evitar drift entre snapshot do briefing e do chat.

---

## 5. Schema — migration `0013_coach_chat.sql`

```sql
-- coach_memory_candidate (staging para extrações pendentes)
create table if not exists public.coach_memory_candidate (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_log_id uuid references public.coach_log(id) on delete set null,
  kind public.memory_kind not null,
  content text not null,
  relevance smallint not null default 50 check (relevance between 0 and 100),
  expires_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists coach_mem_cand_pending_idx
  on public.coach_memory_candidate (user_id, status, created_at desc);

-- users.coach_last_read_at — pro badge
alter table public.users
  add column if not exists coach_last_read_at timestamptz;

-- briefings.coach_paragraph — parágrafo do coach no topo do briefing
alter table public.briefings
  add column if not exists coach_paragraph text;

-- coach_log: conversation_id opcional (sessões inferidas; reservado pra agrupamento futuro)
alter table public.coach_log
  add column if not exists conversation_id uuid;
create index if not exists coach_log_user_kind_recent_idx
  on public.coach_log (user_id, kind, created_at desc);
```

**Convenção `coach_profile.check_in_schedule` (jsonb):**

```json
{
  "morning": "07:30",
  "evening": "21:00",
  "emailMorning": true,
  "emailEvening": false,
  "weeklyDay": "SU",
  "weeklyTime": "09:00"
}
```

Todos os campos opcionais. Validação Zod no save.

---

## 6. UI/UX

### 6.1 FAB global

`src/components/coach/CoachFab.tsx`. Render dentro de `ProtectedRoute` ao lado de `BottomNav`. Position fixed `bottom: 88px; right: 16px` (acima do bottom nav). 56×56, círculo, ícone balão (lucide-like inline svg). Badge vermelho topo-direita com count quando `/coach-unread > 0`.

Poll `coach-unread` a cada 60s; invalida ao receber stream do próprio chat ou ao `/coach-mark-read`.

### 6.2 CoachSheet

Bottom-sheet animado de baixo (CSS transform), ocupa ~92vh, fundo `var(--bg-elevated)`, scroll interno.

Layout:

```
┌─ header (sticky top) ──────┐
│ ╳   Coach            ⚙     │
├─ memory candidates banner ─┤  (só se /coach-memory-pending > 0)
│ banner: 3 lembranças       │
│ propostas [ver]            │
├─ messages (scroll) ────────┤
│ ░ hoje ░                   │
│ [coach 09:00] ...          │
│ [você 13:02] ...           │
│ [coach 13:02 ▶] streaming  │
├─ input (sticky bottom) ────┤
│ [textarea autoexpand]  [▶] │
└────────────────────────────┘
```

- Mensagens do coach: texto claro, sem caixa, prefixo timestamp em monospace 9px.
- Mensagens do user: alinhadas direita, caixa sutil `var(--bg-secondary)`.
- Separadores de dia (`hoje`, `ontem`, `13 mai`) em monospace 9px letterspacing 2px.
- Streaming: cursor ▶ piscando no fim do texto até `done`.
- Scroll inicia no fundo. Pull-up: chama `/coach-chat-history?before=<oldestId>` e prepend.
- Ao abrir sheet: chama `/coach-mark-read` e zera badge.

### 6.3 Componentes

```
src/components/coach/
├── CoachFab.tsx              FAB + badge
├── CoachSheet.tsx            container
├── CoachMessage.tsx          renderiza uma msg (user|coach, com streaming flag)
├── CoachInput.tsx            textarea + botão enviar
├── CoachMemoryCandidates.tsx banner + cards [aceitar|editar|descartar]
├── CoachProfilePanel.tsx     form pro coach_profile (em ConfigPage)
└── CoachMemoryList.tsx       lista memórias salvas + edit/archive
```

### 6.4 Hooks

Estender `useCoach`:

```ts
function useCoach() {
  // já existe: profile, memories, saveProfile, saveMemory, archiveMemory
  + sendMessage(content: string): AsyncIterable<string> (chunks)
  + history(opts: { before?: string, limit?: number }): Promise<CoachLogEntry[]>
  + candidates: CoachMemoryCandidate[]
  + acceptCandidate(id: string, edits?: Partial<CoachMemoryEntry>): Promise<void>
  + dismissCandidate(id: string): Promise<void>
  + unreadCount: number
  + markRead(): Promise<void>
}
```

### 6.5 Subaba em ConfigPage

Adicionar tab "Coach" em `ConfigPage`. Renderiza `CoachProfilePanel` + `CoachMemoryList` + bloco "Custo do coach (7d)" (soma `tokens_in/out * preço` de `coach_log`).

---

## 7. Briefing integration

Mudanças em `api/_briefing.ts`:

1. Antes da chamada Haiku atual, adicionar chamada Sonnet 4.6 gerando o **parágrafo do coach** (120-180 palavras) com snapshot completo do user.
2. Persistir em `briefings.coach_paragraph`.
3. Email HTML: inserir bloco no topo, antes de `aqalBlock`:

   ```html
   <div style="margin-bottom:28px;padding:20px;border-left:2px solid #7dd3fc">
     <div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#555;text-transform:uppercase;margin-bottom:10px">do coach</div>
     <div style="font-size:14px;line-height:1.65;color:#ddd;white-space:pre-wrap">${coachParagraph}</div>
   </div>
   ```

4. `content_md` ganha seção `## Coach hoje\n\n{coachParagraph}` antes do AQAL block.
5. Página `BriefingPage` renderiza o parágrafo no topo (mesma identidade do email).

Prompt Sonnet (`buildCoachParagraphPrompt`):

```
Você é {coach}, sócio sênior do Jorge.
Snapshot atual:
{snapshot}

Memórias top 10:
{memories}

Último check-in recente (não repita esse conteúdo):
{lastCheckIn or "(nenhum)"}

Escreva o parágrafo de abertura do briefing matinal (120-180 palavras).
Voz: firme, direta, sem rodeios, sem emoji. Letra minúscula no início.
Estrutura:
- observação concreta sobre o quadro de 7 dias.
- uma cobrança OU celebração específica (cite áreas/projetos reais).
- foco do dia: UMA coisa, não lista.
```

---

## 8. Check-ins agendados

### 8.1 Cron

```json
// vercel.json — adicionar
"crons": [
  { "path": "/api/coach-checkin-cron", "schedule": "0,30 * * * *" }
]
```

A cada 30min. `coach-checkin-cron` valida token admin (header `x-cron-secret`), itera users.

### 8.2 Janela e idempotência

- Janela ±15min do horário configurado. Se cron roda 07:30 e morning = 07:30, dispara. Se morning = 07:31, dispara também (dentro da janela).
- Idempotência: marker HTML-comment na primeira linha de `content_md` (`<!-- morning -->`, `<!-- evening -->`, `<!-- weekly -->`). Query: `WHERE created_at >= today_start AND content_md LIKE '<!-- morning -->%'` etc.
- Renderização frontend: `CoachMessage` faz strip do marker da primeira linha antes de exibir, então o user nunca vê `<!-- ... -->` na UI.

### 8.3 Prompts

**Morning:**
```
Você é {coach}, sócio sênior do Jorge. São {time} da manhã ({day}).
Snapshot:
{snapshot}
Memórias relevantes (promises vencidas/próximas, concerns ativos):
{filtered_memories}

Check-in matinal (max 120 palavras), voz firme-mas-gentil.
Estrutura:
- Uma observação concreta sobre o estado (não genérica).
- Uma cobrança OU celebração específica.
- Um foco pro dia (UMA coisa).

Comece a primeira linha com '<!-- morning -->' (será removido na renderização).
```

**Evening:** análogo, com tasks completas e hábitos do dia. Pergunta de fechamento.

**Weekly:** análogo, com snapshot 7d e weekly review insights (reduzido — sem `reviews` table ainda).

### 8.4 Email

Quando `profile.check_in_schedule.emailMorning === true` e está disparando morning: envia via Resend. Template mais enxuto que o briefing (sem AQAL/agenda/tasks/news — só parágrafo do coach).

---

## 9. Sessões e histórico

- **Sessão** é conceito frontend, inferido por gaps. Não vai pro schema (apenas reservado `coach_log.conversation_id`).
- Histórico é uma timeline única por user. Pull-up no chat carrega mais antigas.
- Não há "começar nova conversa" explícito. Cada nova msg após >4h de gap é renderizada com separador `░ ontem ░` / `░ 13 mai ░`, mas o coach continua vendo as últimas 20 msgs no contexto independente de gap.
- Botão "limpar conversa" — fora de scope. Pra deletar, via SQL ou tela de admin futura.

---

## 10. Custo estimado

| Componente | Modelo | Tokens médios | Custo/dia |
|---|---|---|---|
| Chat (assume 3 conversas × 5 turnos × 4k system) | Sonnet 4.6 | ~75k in + 7.5k out | ~$0.34 |
| Extração de memória (3 chamadas × 2k in) | Haiku 4.5 | ~6k in + 1k out | ~$0.011 |
| Check-in morning + evening (4k system × 2) | Sonnet 4.6 | ~8k in + 0.5k out | ~$0.032 |
| Parágrafo briefing | Sonnet 4.6 | ~3k in + 0.3k out | ~$0.014 |
| **Total/dia esperado** | | | **~$0.40** |

Pior caso (10 conversas longas): ~$1/dia. Aceitável.

Tela em ConfigPage mostra custo agregado por janela de 7d.

---

## 11. Testes / observabilidade

- Vitest pros schemas Zod novos (`coach-chat`, `coach-memory-extract`, `coach-checkin-cron`).
- Vitest pro montador de snapshot: `buildCoachSnapshot` com mocks de Supabase, garante shape e que reusa `fetchAqalContext`.
- E2E mínimo (manual): abrir FAB → mandar msg → ver stream → fechar → reabrir → ver banner de candidates → aceitar uma → ver em memórias.
- Logs: cada chamada Anthropic registra `tokens_in`, `tokens_out`, `model_used` em `coach_log` (já no schema). Endpoint admin futuro pode agregar.

---

## 12. Out-of-scope (explícito)

- Web push PWA (service worker + VAPID).
- Tool use (create_task, save_memory direto via tool_use do Anthropic SDK).
- Weekly review (`kind='review'` já no enum; UI fica pra próxima sprint).
- Voz/áudio no chat.
- Múltiplas conversas paralelas / threads.
- Resumo automático de conversas antigas quando `coach_log` crescer.
- Admin dashboard de custos.

---

## 13. Decisões registradas

| # | Decisão | Razão |
|---|---|---|
| 1 | Voz "sócio sênior" | Aprovada via preview comparativa. |
| 2 | Scope completo (chat + check-ins + briefing) | Jorge quer coach como presença constante desde dia 1. |
| 3 | Snapshot fixo (não tool use) | Simples, previsível, alta qualidade. Reusa `fetchAqalContext`. |
| 4 | Auto-extração com aprovação | Coach precisa lembrar; aprovação evita poluição. |
| 5 | Sonnet 4.6 pro chat, Haiku pra extração | Equilibra raciocínio (chat) e custo (extração). |
| 6 | FAB global + bottom-sheet | Mantém os 7 módulos atuais; coach sempre acessível. |
| 7 | Badge + email (sem push) | PWA push tem complicação; valida UX antes. |
| 8 | Parágrafo do coach no topo do briefing | Mínima mudança no formato atual, alto impacto. |
| 9 | Sem tools no MVP | Reduz risco; adiciona depois quando uso real validar. |

---

## 14. Próximo passo

Após aprovação deste spec → invocar `superpowers:writing-plans` para criar plano de implementação em `docs/superpowers/plans/`.
