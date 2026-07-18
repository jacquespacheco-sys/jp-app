# JP App — Módulo Hill · Pacote de Implementação

> Sistema inspirado em Napoleon Hill, Joseph Murphy e José Silva para acompanhamento de Chief Aim, afirmações, rituais matinal e noturno, mastermind virtual, e coach IA proativo.

**Versão:** v1.0
**Data:** Maio 2026
**Stack alvo:** Next.js + Supabase + Vercel + Anthropic API (Sonnet 4.5 / Haiku 4.5)

---

## 📦 O que tem neste pacote

```
jp_app_hill_package/
├── README.md                              ← este arquivo
├── 01_specs/
│   ├── SPEC_tecnico.md                    ← schema, endpoints, fluxos, custos
│   └── SPEC_daily_nudges.md               ← sistema proativo, gatilhos, pipeline
├── 02_prompts/
│   └── coach_hill_system_prompt.md        ← prompt do LLM (uso direto)
└── 03_mockups/
    ├── 01_compass_goals_coach_mastermind_briefing.html
    ├── 02_ritual_noite.html
    ├── 03_wizard_afirmacoes_overview.html
    ├── 04_wizard_capacidade_relacoes.html
    └── 05_revisao_trimestral.html
```

---

## 🧭 Visão de produto · 30 segundos

O Módulo Hill é uma **camada de propósito** que atravessa o JP App. Em vez de inflar mais uma seção genérica de produtividade, ele:

1. **Ancora** o app num **Chief Aim** (objetivo definido com clareza absoluta, no estilo Napoleon Hill).
2. **Desdobra** em hierarquia Dream → Goal → Quarterly, vinculáveis aos Projects existentes.
3. **Programa** a mente do usuário com **5 afirmações** (estilo Joseph Murphy) lidas no ritual matinal e noturno.
4. **Acompanha** com **rituais** curtos (5min manhã / 4min noite) que viram hábito.
5. **Cobra** com um **Coach IA** que conhece o contexto, fala como Hill, e age via 4 modos (chat, ritual_murmur, wizard_step, daily_nudge).
6. **Evolui** trimestralmente via revisão guiada.
7. **Mastermind virtual** (Invisible Counselors de Hill) para decisões importantes.

**Atribuição entre autores:** Hill = arquitetura e ação. Murphy = afirmações e programação mental. Silva = visualização e respiração. Não competem — se complementam.

---

## 🚦 Ordem recomendada de implementação

A implementação completa é grande. Sugiro fasear:

### Fase 1 · MVP do core (2-3 semanas)
Permite usuário criar aim, escrever afirmações, fazer ritual diário básico.

- [ ] Schema: `chief_aims`, `goals` (sem hierarquia complexa), `affirmations`, `ritual_logs`
- [ ] Endpoints CRUD básicos
- [ ] Tela **Compass** (Chief Aim view + edit)
- [ ] Wizard de afirmações simplificado (sem pausa entre sessões — tudo em 1 dia)
- [ ] Tela **Ritual Manhã** (4 passos)
- [ ] Tela **Ritual Noite** (5 passos)
- [ ] Integração no Briefing (afirmação do dia + nudge placeholder estático)
- [ ] Notificações push manhã (7h) e noite (22h)

**Critério de pronto:** Você consegue fazer um ciclo completo de 7 dias usando o módulo.

### Fase 2 · Coach IA (1-2 semanas)
Liga o LLM e dá voz ao módulo.

- [ ] Schema: `coach_messages`, `hill_preferences`
- [ ] Implementar `lib/hill/coach.ts` com função `generateCoachMessage`
- [ ] Endpoint `POST /api/hill/coach/chat`
- [ ] Tela **Coach Chat** (on-demand)
- [ ] Coach murmurs nos rituais (modo `ritual_murmur`)
- [ ] Coach steps no wizard (modo `wizard_step`)
- [ ] Tela de configurações `hill_preferences`

**Critério de pronto:** Você conversa com o Coach Hill em chat livre e durante rituais ele aparece com murmurs contextuais.

### Fase 3 · Daily Nudges (1-2 semanas)
Coach age proativamente.

- [ ] Implementar todos os 8 gatilhos (SPEC_daily_nudges.md)
- [ ] Cron `/api/hill/cron/daily-nudge`
- [ ] Schema: `nudge_feedback`
- [ ] Tela de histórico de nudges
- [ ] Feedback loop (-1 / 0 / +1)
- [ ] Tela de configuração de categorias

**Critério de pronto:** Você recebe nudges relevantes ao longo da semana, podem ser silenciados, e o sistema aprende com seu feedback.

### Fase 4 · Revisão trimestral + Mastermind (2 semanas)
Fecha o ciclo.

- [ ] Schema: `quarterly_reviews`, `mastermind_counselors`, `mastermind_sessions`
- [ ] Cron `check-quarterly-reviews` (segundas 9h)
- [ ] Fluxo completo da revisão (6 telas do mockup 05)
- [ ] Tela Mastermind (grid de counselors + reunião semanal)
- [ ] Export PDF do manifesto

**Critério de pronto:** Após 90 dias de uso, você completa uma revisão guiada e refina afirmações para Q2.

---

## 🎯 Decisões críticas (tomadas)

Em ordem de impacto:

**D1 · Espinha dorsal é Hill, não três autores em paralelo.**
Murphy entra como linguagem das afirmações; Silva entra como técnica de visualização. Não há "modo Murphy" ou "modo Silva". O Coach é Hill que cita os outros quando aplicável.

**D2 · Coach refina mas nunca reescreve.**
Exceção controlada: dimensão Capacidade no wizard, onde gera versão derivada de evidências escolhidas pelo usuário (marcada `derived: true`).

**D3 · Revisão trimestral é o único ponto legítimo de mudança de afirmações.**
Murphy é categórico: mudar antes mata o efeito. O sistema **trava** edições avulsas e direciona para revisão (exceto via flow de "minha afirmação não toca mais" iniciado pelo usuário, que cria uma revisão antecipada formal).

**D4 · Daily nudge tem teto duro de 1 por dia.**
Não há exceção. Múltiplos gatilhos disputam por prioridade. Anti-spam vence anti-perda de oportunidade.

**D5 · Wizard inicial é distribuído em 3 sessões / 3 dias.**
Pode ser overridado pelo usuário com aviso, mas a default é forçada. O subconsciente precisa de tempo entre afirmações.

**D6 · Dark mode no ritual noturno é obrigatório.**
Estética importa para a experiência do método. Manhã = bg claro + accent verde-limão. Noite = bg escuro + accent âmbar.

---

## 🔧 Stack & dependências

Tudo já existe no JP App. Não há novas dependências de infra.

**Existente reutilizado:**
- Next.js (Vite + Vercel Functions)
- Supabase (Postgres + RLS + Auth)
- Vercel Cron
- Resend (e-mails)
- Anthropic SDK
- `notifications` table (polling de 60s)

**Novo a adicionar (só na lib):**
```bash
# Nada novo. Tudo via SDKs já presentes.
```

---

## 💰 Custos estimados · LLM

Por usuário ativo médio:
- Ritual murmurs (Haiku, 2/dia): ~$0.006/mês
- Daily nudges (Haiku, ~1/dia): ~$0.009/mês
- Chat com coach (Sonnet, ~12/mês): ~$0.06/mês
- Wizard + revisão trimestral (Sonnet, ~30/quarter): ~$0.04/mês

**Total mensal/usuário ativo:** $0.50-$0.80
**A 100 usuários ativos:** ~$50-$80/mês
**A 1.000:** ~$500-$800/mês

Considerar caching agressivo e tier gratuito sem nudges proativos antes de escalar.

---

## 🎨 Identidade visual

Reutiliza variáveis CSS do JP App existente (`#fafaf7` bg, `#a8ff00` accent, Space Grotesk + Bebas Neue + Space Mono).

**Adições para o módulo Hill:**
- `--accent-warm: #ffb84d` (âmbar) → ritual noturno e wizard
- `--hill-paper: #f4ede0` (pergaminho) → momentos cerimoniais (Chief Aim, coach messages)
- `--hill-ink: #1a1308` (tinta antiga) → texto sobre pergaminho
- Font adicional: **Crimson Pro** (serif italic) → textos cerimoniais e afirmações

Mockups em `03_mockups/` mostram aplicação consistente desses tokens.

---

## 🧪 Testes & validação manual

Antes de release, validar:

### Smoke tests
- [ ] Criar Chief Aim → ver renderizado em Compass
- [ ] Completar wizard → 5 afirmações ativas em DB
- [ ] Ritual matinal 100% → log com 4 steps, task criada no Kanban
- [ ] Ritual noturno 100% → log com gratidão, afirmações lidas, visualização
- [ ] Streak de 7 dias matinal → contador correto na Compass

### Coach
- [ ] Chat: pergunta → resposta com voz Hill, com pelo menos 1 pergunta socrática
- [ ] Ritual murmur: aparece após passo 2 do ritual matinal, 1-2 frases
- [ ] Wizard step: detecta externalização em afirmação de Relações
- [ ] Daily nudge: simular task adiada 4 dias → nudge sobre procrastinação

### Hard rules
- [ ] Coach não reescreve afirmação (testar pedido explícito do usuário)
- [ ] Coach declina dar conselho médico/financeiro específico
- [ ] Coach não muda Chief Aim diretamente
- [ ] 2 nudges sobre mesma categoria em < 7 dias → o 2º é bloqueado

### Performance
- [ ] Compass carrega em < 500ms
- [ ] Chat completion em < 5s (Sonnet)
- [ ] Ritual murmur em < 2s (Haiku)
- [ ] Cron diário processa 100 usuários em < 5min

---

## 📐 Onde isso encaixa na navegação do JP App

Decisão final pendente: **bottom-nav** vs **menu hamburguer**.

**Recomendação:** adicionar uma sexta entrada ao bottom-nav (`☾ Hill`) que abre a Compass como home do módulo, com subtabs para Goals, Ritual, Coach, Mastermind. Briefing ganha seção integrada Hill (afirmação + nudge) no topo.

Outra opção: criar **drawer lateral** acessado por ícone no topbar quando dentro do "Modo Hill" — preserva a bottom-nav atual intocada. Vale testar A/B.

---

## ⚠️ Riscos & mitigações (resumo)

| Risco | Mitigação |
|-------|-----------|
| Latência Sonnet no chat | Streaming SSE no front |
| Custo escalando com base | Caching, tier free sem nudges |
| Falsos positivos em nudges | Feedback loop -1 desabilita 30 dias |
| Wizard abandonado | Ritual noturno fallback sem afirmações |
| Coach quebrar tom | Avaliação manual periódica + thumbs-down |
| Usuário se viciando no coach | Hard limit de 1 nudge/dia; off-switch real |

Detalhamento em `SPEC_tecnico.md` § 14 e `SPEC_daily_nudges.md` § 9.

---

## 🚀 Como começar amanhã

**Dia 1:**
1. Ler os 2 specs (`SPEC_tecnico.md`, `SPEC_daily_nudges.md`) — 1h
2. Abrir os 5 mockups e navegar — 30min
3. Ler o system prompt do coach — 15min
4. Criar branch `feature/hill-mvp`
5. Rodar migrations da Fase 1 (chief_aims, goals, affirmations, ritual_logs)

**Semana 1:**
- Backend Fase 1 funcionando (CRUD + auth)
- Tela Compass implementada (apenas leitura por enquanto)

**Semana 2:**
- Wizard de afirmações funcionando
- Persistência em `wizard_state` com pausa de 24h

**Semana 3:**
- Ritual matinal e noturno funcionando
- Notificações push agendadas

**Aí volta aqui para Fase 2 (Coach IA).**

---

## 📞 Pontos de decisão deixados em aberto

São decisões que **você** ou **eu junto com você** precisamos resolver durante a implementação. Listadas aqui para não esquecer:

- [ ] **Pricing tier:** o módulo Hill é parte da assinatura padrão ou um add-on?
- [ ] **Onboarding:** o módulo é opt-in (usuário ativa) ou ativo por padrão e pode desativar?
- [ ] **Voz do coach personalizável:** ativar opção "strict/mixed/gentle" desde v1 ou deixar para v2?
- [ ] **Áudio guiado no Ritual passo 4 (visualização):** v1 ou v2?
- [ ] **Mastermind voices configuráveis:** sugerir 5 pré-definidos ou usuário escolhe do zero?
- [ ] **Export PDF do manifesto:** server-side (puppeteer) ou client-side (jsPDF)?
- [ ] **Idiomas:** Português-BR only em v1 ou já incluir inglês?

---

## 📚 Origem dos autores · referências (sem citar nos prompts)

Para implementar o coach com fidelidade, vale o time conhecer:

- **Napoleon Hill** — *Think and Grow Rich* (1937), *Outwitting the Devil* (escrito 1938, publicado 2011)
- **Joseph Murphy** — *The Power of Your Subconscious Mind* (1963)
- **José Silva** — *The Silva Mind Control Method* (1977)

Não precisa ter lido tudo. O system prompt já encapsula o método. Mas se o time for refinar tom no futuro, essa é a referência primária.

---

## 🤝 Histórico de decisões deste pacote

Este pacote foi construído iterativamente em conversas. Decisões importantes:

1. **Não criar app separado** — integrar como módulo do JP App ✓
2. **Hill como espinha, Murphy/Silva como camadas** — não três módulos paralelos ✓
3. **Sessões distribuídas no wizard** — pausa enforced de 24h ✓
4. **Coach refina mas não reescreve** — exceção controlada apenas em Capacidade ✓
5. **Revisão trimestral é o único ponto legítimo de mudança de afirmações** ✓
6. **4 modos do coach** (chat, ritual_murmur, wizard_step, daily_nudge) ✓
7. **Dark mode no ritual noturno** — estética importa ✓
8. **Daily nudge com teto de 1/dia, 8 categorias, feedback loop** ✓
9. **Mastermind opcional, fora do core MVP** ✓

---

**Fim do README. Bom desenvolvimento.**
