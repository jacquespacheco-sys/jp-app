# JP App — Contatos · Pacote Carnegie
## 06 · Prompt opcional · PR 7 · Wizard de classificação inicial

> **Quando rodar:** depois do PR 3 (Provider + ContactPanel novas abas) e da Onda 1 SQL. Antes do PR 4 (Pulso), idealmente — pra você abrir o Pulso já com tiers e hooks preenchidos.
>
> **Por quê:** o SQL automático classifica ~40% dos contatos. O resto fica `weak` por default. Sem revisão, Pulso fica desbalanceado e Rituais (Thank You Tour) não tem pré-selecionados de qualidade. O wizard faz isso em 30-60 minutos numa sentada só.

---

## Prompt para Claude Code

Quando estiver pronto, cole exatamente isso:

```
PR 7 (opcional, mas recomendado antes do PR 4). Escopo: criar um wizard de classificação inicial dos contatos. Tela one-time que aparece quando o user tem contatos sem hooks de conversa preenchidos. Permite passar pela lista priorizada e classificar tier + adicionar 1-2 hooks rapidamente.

IMPORTANTE: se o PR 8 (categorias multidimensionais) já estiver mergeado quando você implementar esse wizard, adicionar Pergunta 4 opcional ao final de cada card: "Adicionar categorias?" → componente que mostra dropdowns/multi-selects por dimensão (usar useCategories.byDimension). Multi-select de categorias por dimensão. Chama contactsProvider.setContactCategories(contactId, categoryIds[]) no save. Se PR 8 não estiver mergeado, ignorar Pergunta 4.

Tarefas:

1. Endpoint novo `api/contacts-onboarding-queue.ts` (GET):
   - Retorna lista de contatos do user ordenada por prioridade de classificação:
     - Primeiro: tier IS NULL (não classificados ainda)
     - Depois: tier IN ('inner','strong') com array_length(conversation_hooks) = 0
     - Por último: tier IN ('inner','strong') com array_length(conversation_hooks) < 3
   - Limite default: 50 itens
   - Response: `{ items: ContactQueueItem[], totalRemaining: number, currentCounts: { inner: n, strong: n, network: n, weak: n, dormant: n } }`
   - ContactQueueItem inclui: id, firstName, lastName, company, role, tier, lastInteractionAt, interactionCount (últimos 12m), suggestedTier (heurística do backend baseada nos dados disponíveis), conversation_hooks (atual)
   - `suggestedTier` calcula no backend: se phase=active e interaction recente → 'strong'; se tags contém família → 'inner'; etc (mesmas regras do SQL de Onda 1, mas para os que ainda estão null).

2. Endpoint novo `api/contacts-bulk-classify.ts` (POST):
   - Body: `{ updates: [{ id, tier?, addHook?: string }] }` — aceita uma ou mais atualizações em uma chamada
   - Para cada update: 
     - Se tier preenchido: UPDATE contacts SET tier = ?
     - Se addHook: UPDATE contacts SET conversation_hooks = array_append(coalesce(conversation_hooks, '{}'), ?)
   - Filtro user_id em todas as queries
   - Schema Zod com array max 100 updates
   - Response: `{ updated: number }`

3. Nova rota `/onboarding-contatos` em src/App.tsx:
   - Não vai pelo bottom-nav (rota direta)
   - Card-link no Pulso (PR 4): "Você tem N contatos sem classificar — revisar?" se totalRemaining > 0

4. Página nova `src/pages/ContactsOnboardingPage.tsx`:
   - Header fixo no topo:
     - Título "Classificação inicial · Carnegie"
     - Progress: "X de Y revisados" + barra de progresso
     - **Contador Dunbar ao vivo:** "Inner 4/5 · Strong 23/50 · Network 67/150" — atualiza após cada classificação. Se Inner > 5, badge vermelho de alerta.
     - Botão "Pular tudo / Finalizar"
   
   - Body — uma tela por contato (swipe ou next button):
     - Card grande com nome, empresa, role
     - Linha de contexto: "Última interação: 23/04 (call) · 12 interações nos últimos 12m"
     - Sugestão do sistema: "Sugerido: STRONG" (com link "por quê?" mostrando a heurística)
     - **Pergunta 1 (obrigatória):** "Que tier?" — 5 botões grandes em linha:
       - INNER (vermelho · "família, sócios, top 5")
       - STRONG (laranja · "ativos, contato regular")
       - NETWORK (amarelo · "conheço, contato esporádico")
       - WEAK (cinza · "conheço pouco")
       - DORMANT (cinza-escuro · "já fomos próximos, sumiu")
     - **Pergunta 2 (obrigatória se inner/strong, opcional outros):** "Adicione 1 hook de conversa"
       - Textarea pequeno com placeholder "Ex: Helena (filha) entrou em Letras na USP em fev/26"
       - Pode pular com botão "Não sei agora" (passa pro próximo)
     - **Pergunta 3 (opcional, atalho):** "Algo mais?" — botões pequenos:
       - "+ Outro hook" (abre textarea de novo)
       - "Marcar canal preferido" (dropdown rápido)
       - "Adicionar LinkedIn" (input URL)
       - "Definir cadência custom" (input dias)
     - Botões de navegação no rodapé: ← Anterior | **Salvar e próximo →** | Pular essa pessoa

   - Comportamento:
     - "Salvar e próximo" salva via /api/contacts-bulk-classify e avança
     - Salvamento em background (otimista) — não bloqueia próximo
     - Auto-save a cada N segundos se houver mudanças
     - Pode usar setas do teclado (←/→) e atalho Enter pra salvar
     - Atalhos numéricos: 1=Inner, 2=Strong, 3=Network, 4=Weak, 5=Dormant
   
   - Fim da fila:
     - Tela de conclusão: "X contatos classificados. Inner: N · Strong: N. Pulso pronto para você."
     - Botão "Ir para o Pulso"

5. Hook novo `src/hooks/useOnboardingQueue.ts`:
   - Fetch queue inicial
   - Função `classify({ id, tier, hooks })` — chama bulk-classify, remove o item da fila localmente
   - Função `skip(id)` — só remove localmente
   - Estado: `currentItem`, `index`, `total`, `counts` (Dunbar)
   - **Atenção:** depois que o Provider de Contacts existir (PR 3), o hook deve invalidar/atualizar o cache do ContactsProvider após cada save — pra o resto do app refletir as mudanças.

6. Link no Config: nova entrada "Classificação inicial Carnegie" em ConfigPage, sempre disponível (mesmo após terminar — pra refazer pessoas específicas).

7. Estilo:
   - Usar CSS variables existentes do globals.css
   - Card-by-card centralizada, max-width 540px
   - Animação leve de transição entre cards (fade ou slide)
   - Mobile-friendly: botões grandes, gestos de swipe opcionais

8. Testes:
   - Schema bulk-classify
   - Lógica de priorização da queue
   - Component render do wizard

9. **Validação final:** `npm test && npm run build`.

Critério de aceite:
- Eu consigo passar por 50 contatos em 30-40 minutos
- A cada save, o contador Dunbar atualiza
- Se eu tentar marcar um 6º Inner, recebo aviso (mas posso forçar)
- Ao terminar, o Pulso já abre com tiers preenchidos e hooks visíveis nos cards

Padrões obrigatórios (do CLAUDE.md):
- requireAuth nos handlers
- safeParse Zod com 400 + issues[0].message
- Filtro user_id em queries
- exactOptionalPropertyTypes (spread-conditional)
- Imports .js em api/
- Sem inline color hex no frontend, CSS variables
```

---

## Como usar este wizard depois de pronto

**Sessão única, 30-60 minutos:**
1. Abre `/onboarding-contatos`
2. Pega um café
3. Passa pela fila inteira (atalhos de teclado: 1-5 tier + Tab pra textarea + Enter pra avançar)
4. Termina com Pulso povoado

**Sessões parciais:**
- Pode parar a qualquer momento, retomar pelo Config
- Cada save é independente

**Refinamento orgânico (depois):**
- Conforme você for usando o app, vai voltar pelo Config se quiser refinar contatos específicos
- O sistema sempre lista quem ainda tá `null` ou `weak` sem hooks

---

## Variação se você não quer implementar o PR 7

Caso não queira o wizard dedicado, dá pra fazer manualmente após PR 3:

1. Vai na subtab Contatos
2. Abre cada contato relevante (inner+strong óbvios)
3. Aba "Carnegie" → preenche tier, hook, what_they_value
4. Repete

Funciona — só é mais lento sem o flow guiado. Para 200 contatos, **vale o PR 7**. Para 50, manual é OK.

---

## Variação minimalista (15 min)

Se você quer o mínimo viável **sem PR 7**:
1. Roda Onda 1 SQL
2. Audita tiers `inner` no SQL editor (corrige os errados)
3. Para os top 10 contatos `strong` mais importantes, abre no app (após PR 3) e adiciona 1 hook em cada
4. Esquece o resto — vai virando orgânico

Isso já é suficiente pra Pulso funcionar bem desde o dia 1.

---

*Fim do pacote. Total de arquivos: 7 (00 a 06). Boa implementação.*
