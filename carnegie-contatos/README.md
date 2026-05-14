# Pacote Carnegie · JP App

> **Leia este arquivo primeiro.** É o índice e o mapa do que tem aqui dentro.

Este pacote transforma o módulo Contatos do JP App num sistema de gestão de relacionamentos inspirado em Dale Carnegie, Keith Ferrazzi (*Never Eat Alone*), Adam Grant (*Give and Take*), David Maister (*Trusted Advisor*) e Robin Dunbar (números antropológicos).

A camada é **aditiva** — não substitui nada do app existente. Estende `contacts` e `interactions`, adiciona tabelas de datas especiais, indicações, elogios e rituais pessoais, e cria duas subtabs novas (Pulso, Rituais) na página de Contatos.

---

## O que tem aqui dentro

9 arquivos em ordem de leitura/execução:

| # | Arquivo | O que é | Quando ler |
|---|---|---|---|
| **00** | `00_BRIEFING.md` | Visão executiva: o que muda, por que, decisões já tomadas | **Antes de tudo** |
| **01** | `01_MIGRATION_0014_carnegie_base.sql` | SQL: extensões em contacts/interactions + 3 tabelas (special_dates, referrals, compliments_received) + triggers + views | Quando o PR 1 começar |
| **02** | `02_MIGRATION_0015_rituals_personal.sql` | SQL: 3 tabelas dos rituais (principle_of_month, weekly_reflections, gratitude_entries) | Quando o PR 2 começar |
| **03** | `03_PROMPTS_CLAUDE_CODE.md` | Sequência de 7 prompts em ordem (PR 0 setup, PR 1-6 implementação) — **arquivo principal** | Para colar no Claude Code, um por vez |
| **04** | `04_ONBOARDING_DATA_MIGRATION.md` | Estratégia das 3 ondas para popular a base de contatos existente | Entre PR 1 e PR 4 |
| **05** | `05_SQL_initial_classification.sql` | Script SQL idempotente — classifica ~40% dos contatos automaticamente (Onda 1) | Após PR 1 mergeado |
| **06** | `06_PROMPT_PR7_onboarding_wizard.md` | Prompt opcional pro Claude Code criar wizard de classificação guiada (Onda 2) | Após PR 3, antes de PR 4 (opcional) |
| **07** | `07_MIGRATION_0016_categories.sql` | SQL: sistema de categorias multidimensionais com seed (Perfil/Assunto/Aproximação) | Quando o PR 8 começar |
| **08** | `08_PROMPT_PR8_categories.md` | Prompt pro Claude Code criar sistema de categorias + chips + filtros nas views | Após PR 3, antes de PR 4 |

---

## Caminho recomendado (sem decisão a tomar)

Se você quer só seguir e deixar o pacote te guiar:

```
1. Leia 00_BRIEFING.md (10 min)
2. Leia 04_ONBOARDING_DATA_MIGRATION.md (5 min)
3. Backup do Supabase (snapshot)
4. git checkout -b feature/carnegie-contatos
5. Copia carnegie-pack/ pra raiz do repo localmente
6. Abre Claude Code
7. Cola Prompt 0 do 03 → espera análise dele
8. Cola PR 1 do 03 → espera mergear (testes verdes)
9. Roda Onda 1 (script 05) no SQL editor do Supabase
10. Audita os tiers no SQL editor (queries no fim do 05)
11. Cola PR 2 do 03
12. Cola PR 3 do 03
13. Cola PR 8 do 08 (sistema de categorias + filtros)
14. (Opcional) Cola PR 7 do 06 → roda wizard quando estiver pronto
15. Cola PR 4 do 03
16. Cola PR 5 do 03
17. (Futuro) PR 6 e atualização de SPEC/CLAUDE/REVIEW
```

Tempo estimado:
- **Implementação Claude Code:** ~5-7h corridas se tudo der certo
- **Seu tempo de revisão + ondas:** ~2h
- **Total wall-clock se for sentar uma tarde:** dá pra fazer PRs 1-3 + Onda 1 + Onda 2 num só bloco
- **Total wall-clock se for ir aos poucos:** 1 PR por dia, 2 semanas

---

## Decisões já tomadas (do briefing)

Para não rediscutir durante a implementação:

1. **Promessas = Tasks com tag `#promessa`.** Sem tabela nova. Reusa todo o ciclo GTD.
2. **Tier coexiste com phase.** Tier é cadência relacional (inner/strong/network/weak/dormant), phase é CRM comercial (prospect/talking/active/dormant).
3. **PWA push fica pra depois.** Lembretes vão via briefing matinal, email separado e cards in-app.
4. **Sinais LinkedIn: MVP manual.** UI permite registrar sinal; automação RSS/scraper fica fora desta fase.
5. **Sem ORM.** SQL puro via Supabase, conforme padrão existente do app.
6. **Provider único pra Contacts.** Refatorar `useContacts` (modelo `CoachProvider`) no PR 3.
7. **Tags em array.** `interaction_tags`, `carnegie_tags` como `text[]` (consistente com `tasks.tags`, `contacts.tags`).
8. **Anthropic via `getAnthropic()`** singleton. Haiku para classificar, Sonnet para sugerir mensagem.
9. **Reflexão semanal e Diário de gratidão como rituais fechados** (sua escolha na conversa anterior).
10. **Notificação mix:** crítico = push (quando PWA estiver pronto), resto = briefing e in-app.
11. **Categorias estruturadas em dimensões.** Não `tags[]` livre. 3 tabelas (`category_dimensions`, `categories`, `contact_categories`). Many-to-many. Cor opcional. Seed inicial 3 dimensões (Perfil/Assunto/Aproximação) + 12 categorias.
12. **`tags[]` legado mantido.** A coluna existente em `contacts` continua, mas não é mais a fonte primária. Pode virar onda 4 de onboarding no futuro (migrar tags pra categorias).

---

## O que está fora desta fase (parking lot)

Anotado em `00_BRIEFING.md` §7. Itens que vão ser adicionados depois conforme uso real mostrar necessidade:

- Power List Top 50
- Sugestões "apresente A pra B" automáticas
- Cluster de contatos por cidade durante viagens
- Sumiço detectado (anomaly detection)
- Modo luto / descanso / viagem
- PWA notifications reais
- LinkedIn scraping automático
- Retrospectiva anual auto-gerada
- Editorial planner do LinkedIn

---

## Princípios diretores (curtos, pra colar no CLAUDE.md depois)

Quando estiver implementando esse módulo, mantenha estes 10 princípios:

1. **Captura em < 60 segundos no mobile.** Sempre.
2. **O sistema lembra para o JP estar presente.** Não substitui presença.
3. **Sugere oportunidade, nunca redige a mensagem.** O texto sai do JP.
4. **Cadência por tier.** Sem alerta universal.
5. **Promessa é dado de primeira classe.** Não nota livre — Task com tag.
6. **Reflexão é opcional mas valorizada.** Mini-form pós-interação.
7. **Sinais externos são lembretes, não substitutos.** Posts no LinkedIn não viram interações.
8. **Métricas existem pro JP, não pro JP se cobrar.**
9. **Privacidade: notas pessoais são frágeis.** Tratar como diário.
10. **Carnegie é a base, mas não dogma.** Generosidade > tática.

---

## Suporte durante a implementação

Se o Claude Code travar ou produzir algo que diverge do CLAUDE.md/SPEC.md:

- **Pare o PR atual.** Não acumule problemas em PRs maiores.
- **Mostre o output dele pro Claude no chat (aqui).** Vou ajudar a debugar.
- **Atualize o prompt no 03 se necessário** — você pode editar antes de colar.

Quando todos os PRs terminarem:

- Atualize `SPEC.md` (§3, §7, §9.8)
- Atualize `CLAUDE.md` (estrutura de pastas)
- Atualize `REVIEW.md` (mover BirthdaysStrip pra resolvido, adicionar parking lot Carnegie v2)
- Faça squash + merge na main
- Deleta a branch local

---

## Glossário rápido

**Carnegie principles (P1-P30):** os 30 princípios do livro *Como Fazer Amigos e Influenciar Pessoas*. Lista completa no `00_BRIEFING.md` ou em `src/lib/carnegie.ts` (criado no PR 4).

**Tier:** classificação de proximidade do contato. Define a cadência alvo de contato.
- **inner** (14 dias) — top 5, família, sócios
- **strong** (30 dias) — clientes ativos, mentores, time
- **network** (90 dias) — ex-clientes, contatos esporádicos
- **weak** (180 dias) — conhecidos
- **dormant** (365 dias) — reativações anuais

**Hook (conversation_hook):** um tópico que destrava conversa com aquela pessoa. Ex: "Helena entrou em Letras na USP em fev/26". Aplicação do princípio P8.

**Favor balance:** saldo de generosidade com aquela pessoa. +1 quando você dá (intro, referral, advice, gift); -1 quando recebe. Positivo é bom (você dá mais que recebe). Muito positivo prolongado (>+5 por 12m) = sinal de que talvez seja um Taker.

**Loop de indicação:** quando alguém te indica algo (designer, contato, oportunidade). 30 dias depois o app pergunta se você deu feedback pra essa pessoa. Fechar loops constrói reputação como giver.

**Thank You Tour:** ritual trimestral. App pré-seleciona 5-10 pessoas que te ajudaram concretamente nos últimos 90 dias. Você escolhe 3 e manda mensagem honesta. Sem pedir nada.

**Princípio do mês:** rotação dos 30 princípios Carnegie. Foco mensal consciente. Métricas vão pro review.

**Dunbar numbers:** limites antropológicos de relacionamentos sustentáveis. 5 inner, 15 close, 50 strong, 150 stable. Dashboard no PR 6 (opcional).

**Dimensão de categoria:** eixo de classificação criado pelo user. Ex: Perfil, Assunto, Aproximação, Setor, Cidade. Cada dimensão tem múltiplas categorias.

**Categoria:** opção dentro de uma dimensão. Ex: dimensão "Perfil" tem categorias "Investidor", "Cliente", "Fornecedor", "Parceiro". Pode ter cor opcional. Um contato pode receber múltiplas categorias em qualquer dimensão.

**Filtro combinado:** filtragem multidimensional. Ex: "Investidor + Cliente + Impacto" = (Investidor OR Cliente) AND Impacto. OR dentro da mesma dimensão, AND entre dimensões.

---

*Pacote gerado em maio de 2026. Versão 1.0.*

*Boa implementação. Construa devagar, teste cada PR, e use por uma semana antes de adicionar mais.*
