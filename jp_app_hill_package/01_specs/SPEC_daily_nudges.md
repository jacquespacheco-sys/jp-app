# Coach Hill — Daily Nudges · Sistema Proativo

> O daily nudge é a única forma do Coach Hill agir sem ser chamado. Por isso precisa de regras estritas: dados objetivos, frequência baixa, conteúdo único, ação clara.

---

## 1. Princípios fundamentais

**P1 — Máximo 1 nudge por dia.**
Mais que isso vira ruído. Se múltiplos gatilhos disparam no mesmo dia, escolhe-se o de maior prioridade.

**P2 — Nunca repetir nudge similar em 7 dias.**
Antes de gerar, o sistema consulta `recent_nudges` e bloqueia se houver match por categoria. Usuário não pode receber 3 nudges sobre procrastinação em uma semana.

**P3 — Sempre acionável.**
Cada nudge termina com 1 ação concreta que cabe num botão. Sem isso, vira motivação genérica.

**P4 — Sempre contextual.**
"Você adiou X 4 dias" é nudge. "Hoje é um ótimo dia para focar" não é.

**P5 — Off-switch real.**
Usuário pode desabilitar nudges por categoria, ou todos. Sem culpa.

**P6 — Falha silenciosa.**
Se o LLM não gerar algo bom, ou se nenhum gatilho dispara, não há nudge. Melhor nada do que ruim.

---

## 2. Os 8 gatilhos · catálogo completo

Cada gatilho tem: nome, condição SQL/lógica, prioridade, frequência máxima, framing voice (qual autor inspira a citação), action default.

### G1 · Procrastinação em task ligada ao aim

**Condição:**
```sql
SELECT t.* FROM tasks t
JOIN goals g ON g.id = t.linked_goal_id
WHERE t.user_id = $1
  AND t.status IN ('inbox', 'next')
  AND g.chief_aim_id IS NOT NULL
  AND t.due < CURRENT_DATE - INTERVAL '3 days'
  AND t.created_at < CURRENT_DATE - INTERVAL '4 days'
ORDER BY (CURRENT_DATE - t.due) DESC
LIMIT 1
```

**Prioridade:** 95 (alta — é o coração do método Hill)
**Cooldown:** 7 dias na mesma task; 4 dias na mesma categoria
**Voice:** Hill (procrastinação, "álibi")
**Action:** `schedule_focus` — bloquear horário no calendário

**Exemplo de output:**
> Quatro dias adiando o pitch do Bimbo. Hill chamaria isso de álibi — esperar a informação perfeita antes de agir. A decisão tomada com 80% de informação supera a decisão atrasada por 100%.
>
> Bloqueie 9h-11h hoje. Monte com o que tem. Ajusta depois.

---

### G2 · Afirmação com skip alto

**Condição:**
```sql
SELECT a.*, 
  (CARDINALITY(rl.affirmations_skipped) FILTER (WHERE a.id = ANY(rl.affirmations_skipped))::float / COUNT(*)) AS skip_rate
FROM affirmations a
JOIN ritual_logs rl ON rl.user_id = a.user_id
WHERE a.user_id = $1
  AND a.status = 'active'
  AND rl.created_at >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY a.id
HAVING skip_rate > 0.30
```

**Prioridade:** 70
**Cooldown:** 14 dias na mesma afirmação
**Voice:** Murphy (fé, palavras que não tocam)
**Action:** `open_screen` → `affirmation_edit`

**Exemplo:**
> Sua afirmação IV — *"Atraio as pessoas certas..."* — você pulou 8 vezes nas últimas 2 semanas. Murphy diria que isso é sinal: a frase não toca mais.
>
> Não precisa esperar a revisão trimestral pra editar. Mexa quando souber por quê.

---

### G3 · Goal Q com risco de prazo

**Condição:**
```sql
SELECT * FROM goals
WHERE user_id = $1
  AND level = 'quarterly'
  AND status = 'active'
  AND deadline <= CURRENT_DATE + INTERVAL '21 days'
  AND progress_pct < 50
ORDER BY deadline ASC
LIMIT 1
```

**Prioridade:** 85
**Cooldown:** 10 dias no mesmo goal
**Voice:** Hill (plano organizado, decisão)
**Action:** `open_screen` → `goal_detail`

**Exemplo:**
> *Onboarding fluido + 50 beta users* está em 38% com 21 dias até o prazo. Pelo ritmo atual, fecha em 47%.
>
> Hill insistia em revisar planos quando os números não confirmam. Não é hora de empurrar mais — é hora de redesenhar o plano. Qual gargalo está te segurando?

---

### G4 · Streak quebrada após hábito formado

**Condição:**
```sql
-- Tinha streak ≥ 7 dias, e hoje faltou
WITH last_completed AS (
  SELECT MAX(DATE(completed_at)) as last_day, 'morning' as type
  FROM ritual_logs WHERE user_id = $1 AND type = 'morning' AND completed_at IS NOT NULL
  UNION ALL
  SELECT MAX(DATE(completed_at)) as last_day, 'night' as type
  FROM ritual_logs WHERE user_id = $1 AND type = 'night' AND completed_at IS NOT NULL
),
prev_streak AS (
  SELECT type, COUNT(*) as streak FROM (
    SELECT type, DATE(completed_at), 
      LAG(DATE(completed_at)) OVER (PARTITION BY type ORDER BY DATE(completed_at)) as prev_day
    FROM ritual_logs WHERE user_id = $1 AND completed_at IS NOT NULL
  ) x WHERE prev_day = DATE(completed_at) - 1 GROUP BY type
)
SELECT lc.type FROM last_completed lc
JOIN prev_streak ps ON ps.type = lc.type
WHERE lc.last_day = CURRENT_DATE - 1   -- ontem foi último
  AND ps.streak >= 7
```

**Prioridade:** 60
**Cooldown:** 3 dias
**Voice:** Hill (persistência, mas sem cobrança)
**Action:** `open_screen` → `ritual` (manhã ou noite)

**Exemplo:**
> Doze manhãs seguidas. Ontem você quebrou. Não é cobrança — é observação.
>
> Hill respeitava o ritmo de cada um. Mas notou: quem volta no dia seguinte, mantém. Quem espera "a semana que vem", reinicia do zero.

---

### G5 · Goal próximo de ser batido

**Condição:**
```sql
SELECT * FROM goals
WHERE user_id = $1
  AND status = 'active'
  AND progress_pct >= 85
  AND deadline > CURRENT_DATE
```

**Prioridade:** 75
**Cooldown:** uma única vez por goal
**Voice:** Hill (decisão, finalizar)
**Action:** `mark_complete` → confirma e marca

**Exemplo:**
> *Fechar 3 eventos corporativos* está em 92%. Falta um passo.
>
> Hill chamava de "última milha" — o lugar onde mais gente desiste, porque parece que já está feito. Termine hoje.

---

### G6 · Inatividade no app (apreensão preventiva)

**Condição:**
```sql
SELECT 
  (CURRENT_DATE - MAX(DATE(started_at))) as days_since
FROM ritual_logs
WHERE user_id = $1
HAVING (CURRENT_DATE - MAX(DATE(started_at))) BETWEEN 3 AND 7
```

**Prioridade:** 50
**Cooldown:** 5 dias
**Voice:** Murphy (gentileza, sem julgamento)
**Action:** `open_screen` → `compass` (Chief Aim)

**Exemplo:**
> Cinco dias sem ritual. Não vim cobrar — vim lembrar.
>
> Murphy dizia: *"o subconsciente não esquece, mas precisa ser convidado de volta."* O Chief Aim está lá. Você sabe onde encontrar.

---

### G7 · Padrão de skip da gratidão

**Condição:**
```sql
-- Usuário completa ritual noturno mas o array gratitude_items vem vazio em > 50% dos últimos 10
SELECT 
  COUNT(*) FILTER (WHERE gratitude_items = '{}' OR gratitude_items IS NULL)::float / COUNT(*) as skip_rate
FROM ritual_logs
WHERE user_id = $1
  AND type = 'night'
  AND completed_at IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '10 days'
HAVING skip_rate > 0.5
```

**Prioridade:** 40
**Cooldown:** 21 dias
**Voice:** Murphy (gratidão como técnica)
**Action:** nenhuma (só reflexão)

**Exemplo:**
> Você tem completado o ritual noturno mas pulado a gratidão. Não é capricho — é técnica.
>
> Murphy era enfático: a gratidão é o portão pelo qual o subconsciente entra em estado receptivo. Sem ela, as afirmações que vêm depois caem na areia.
>
> Tente hoje. Três coisas pequenas bastam.

---

### G8 · Marco de tempo significativo

**Condição:** trigger baseado em datas:
- 30 dias do Chief Aim (primeiro mês completo)
- 100 rituais completados
- Aniversário do app
- 1 ano de uso

**Prioridade:** 30
**Cooldown:** evento único por marco
**Voice:** Hill (perspectiva, persistência)
**Action:** `open_screen` → `compass` ou tela de stats

**Exemplo (30 dias do aim):**
> Um mês desde que você escreveu seu Chief Aim. Trinta manhãs lendo a mesma frase.
>
> Hill dizia: *"o desejo definido sustentado por trinta dias começa a se tornar obsessão construtiva."* Você está no momento de virada.
>
> Releia o aim. Ele ainda te acende?

---

## 3. Pipeline de geração · pseudocódigo

```typescript
// /api/hill/cron/daily-nudge — roda às 7h30

async function dailyNudgeCron() {
  const activeUsers = await getActiveUsers()  // com nudges_enabled = true

  for (const user of activeUsers) {
    try {
      await processUserNudge(user.id)
    } catch (err) {
      logError('daily-nudge', user.id, err)
      // continua para próximos usuários
    }
  }
}

async function processUserNudge(userId: string) {
  // 1. Verificar se usuário tem nudges habilitados
  const prefs = await getUserNudgePrefs(userId)
  if (!prefs.enabled) return

  // 2. Verificar se já recebeu nudge hoje
  const todayNudge = await getNudgeSentToday(userId)
  if (todayNudge) return

  // 3. Avaliar TODOS os gatilhos em ordem de prioridade
  const triggers = await evaluateAllTriggers(userId)
  if (triggers.length === 0) return  // nada hoje

  // 4. Filtrar por cooldown
  const recentNudges = await getRecentNudges(userId, 30)
  const eligibleTriggers = triggers.filter(t => 
    !isInCooldown(t, recentNudges) && 
    !prefs.disabled_categories.includes(t.category)
  )
  if (eligibleTriggers.length === 0) return

  // 5. Escolher o de maior prioridade
  const selected = eligibleTriggers.sort((a, b) => b.priority - a.priority)[0]

  // 6. Gerar conteúdo via Coach
  const coachOutput = await generateCoachMessage({
    userId,
    mode: 'daily_nudge',
    trigger: selected.description,
    contextOverride: selected.context  // gatilho específico
  })

  // 7. Persistir + enviar
  await persistNudge({
    userId,
    triggerName: selected.name,
    category: selected.category,
    content: coachOutput.content,
    action: coachOutput.action
  })

  await sendNotification(userId, {
    type: 'hill_daily_nudge',
    title: 'Coach Hill',
    body: coachOutput.content.substring(0, 120) + '...',
    link_to: '/hill/coach?nudge_id=' + selected.id
  })
}
```

---

## 4. Schema de suporte

Adicionar à tabela `coach_messages` o conceito de "nudge":

```sql
-- coach_messages já criada no spec; adicionar coluna
alter table coach_messages add column nudge_category text;
alter table coach_messages add column nudge_trigger text;
alter table coach_messages add column user_dismissed boolean default false;
alter table coach_messages add column user_feedback smallint;  -- -1, 0, +1

create index coach_messages_nudges 
  on coach_messages(user_id, nudge_category, created_at desc) 
  where mode = 'daily_nudge';
```

E preferências do usuário:

```sql
create table hill_preferences (
  user_id                 uuid primary key references users(id),
  nudges_enabled          boolean not null default true,
  nudge_hour              smallint not null default 8,    -- hora local
  disabled_categories     text[] default '{}',
  morning_push_enabled    boolean not null default true,
  morning_push_hour       smallint not null default 7,
  night_push_enabled      boolean not null default true,
  night_push_hour         smallint not null default 22,
  coach_voice_intensity   text not null default 'mixed',  -- 'strict' | 'mixed' | 'gentle'
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);
```

---

## 5. Formato de entrega

### 5.1 Push notification
- **Title:** "Coach Hill"
- **Body:** primeiros 100 chars do nudge + "..."
- **Tap action:** abre tela de Coach com o nudge expandido

### 5.2 In-app (dentro do briefing matinal)
Card preto com voz do Hill, no topo do briefing logo abaixo da afirmação do dia. Já mockado no protótipo original.

### 5.3 Tela dedicada de Coach (nudge expandido)
- Mensagem completa com formatação
- Botão da action (se houver)
- Botão "Útil" / "Não fez sentido" (feedback)
- Botão "Conversar com Coach sobre isso" (abre chat com este nudge como primeira mensagem)

---

## 6. Feedback loop · aprendizado

Cada nudge é avaliável pelo usuário com 3 opções:

| Feedback | Efeito |
|----------|--------|
| `useful` (+1) | Aumenta peso desse gatilho para este usuário |
| `neutral` (0) | Sem efeito |
| `irrelevant` (-1) | Reduz peso do gatilho; 3 negativos seguidos pausam categoria 30 dias |

**Anti-overfit:** O sistema não tenta "agradar" o usuário com mais nudges úteis. Mantém diversidade — se categoria X foi muito útil, ela não bombarda. Diversidade de gatilhos > maximizar utilidade pontual.

```sql
create table nudge_feedback (
  id              uuid primary key default uuid_generate_v4(),
  coach_message_id uuid not null references coach_messages(id),
  user_id         uuid not null references users(id),
  rating          smallint not null check (rating IN (-1, 0, 1)),
  reason          text,
  created_at      timestamptz default now()
);
```

---

## 7. Tela de configuração

Em `/settings/hill/nudges` o usuário vê:

```
NUDGES DIÁRIOS                                  [ATIVO ⚫─]

Horário                                          08:00 ▾

Categorias ativas:
  ✓ Procrastinação em tasks ligadas ao aim
  ✓ Afirmações com baixa adesão
  ✓ Goals com risco de prazo
  ✓ Streaks quebradas
  ✓ Goals quase concluídos
  ☐ Inatividade no app           ← usuário desabilitou
  ✓ Padrão de gratidão
  ✓ Marcos de tempo

Histórico:                       [Ver últimos 30 dias →]
```

---

## 8. Métricas de sucesso · monitoramento

### Métricas de produto
- **% de nudges com feedback positivo** (target: > 60%)
- **% de nudges que geram action click** (target: > 25%)
- **Tempo entre nudge enviado e ação tomada** (mediana < 6h indica relevância)
- **% de usuários que desabilitaram após 30 dias** (target: < 15%)
- **% de dias sem nudge** (saudável: 30-50% — significa que o sistema está sendo seletivo)

### Métricas técnicas
- **Latência da geração** (target: < 4s)
- **Custo médio por nudge** (target: < $0.001)
- **Taxa de falha do cron** (target: < 1%)

### Alertas
- Categoria com feedback negativo > 40% por 7 dias → revisar gatilho ou prompt
- Custo total mensal > orçamento → revisar uso ou downgrade de modelo
- Latência > 10s → investigar API ou contexto inchado

---

## 9. Casos de borda

**Usuário acabou de criar o aim (< 7 dias):**
Nenhum nudge. Sistema dá tempo de baseline acumular.

**Usuário com 0 affirmations ativas (wizard incompleto):**
Apenas categoria G6 (inatividade) e G8 (marcos) elegíveis.

**Usuário pediu pausa explícita:**
`hill_preferences.nudges_enabled = false`. Sistema respeita até reativação manual.

**Múltiplos gatilhos com mesma prioridade:**
Tie-breaker por: 1) mais antiga categoria sem nudge; 2) randomização determinística por hash(user_id + date).

**LLM gera output que viola hard rules:**
Output passa por filtro de validação básico (existência de `<action>` quando esperado, tamanho razoável, sem prompts repetidos). Se falha, fallback: nenhum nudge enviado (princípio P6).

---

## 10. Evolução futura · v2 ideas

- **Adaptive timing:** ML aprende que usuário responde melhor a nudges às 14h em dias úteis
- **Voz personalizada:** usuário pode treinar a voz do coach (mais Hill / mais Murphy / mais Silva) via feedback
- **Smart bundle:** se 2 gatilhos relacionados disparam (procrastinação + afirmação fraca), gerar nudge unificado
- **Anti-padrão detection:** se usuário sempre cancela rituais às segundas, sistema sugere mudança de horário
- **Comunidade (opt-in):** ver nudges anônimos que outros usuários acharam úteis em situações similares

---
