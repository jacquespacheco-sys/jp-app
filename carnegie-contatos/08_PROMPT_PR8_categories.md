# JP App — Contatos · Pacote Carnegie
## 08 · Prompt · PR 8 · Categorias multidimensionais + Filtros

> **Quando rodar:** depois do PR 3 (Provider + ContactPanel) — o ideal é fazer **antes do PR 4 (Pulso)**, porque os filtros vão aparecer também no Pulso.
>
> **Por quê:** tags livres viram bagunça. Esse PR cria um sistema de categorias estruturadas em dimensões (Perfil/Assunto/Aproximação, com extensibilidade pro user adicionar mais), permite múltipla atribuição, cor opcional por categoria, gestão completa em Config, e barras de filtro nas views Contatos, Pipeline e Promessas.

---

## Prompt para Claude Code

Cole exatamente isso:

```
PR 8. Escopo: sistema de categorias multidimensionais para contatos + UI de gestão + chips no ContactPanel + barras de filtro em Contatos/Pipeline/Promessas.

Tarefas:

═══════════════════════════════════════════
PARTE A — BANCO DE DADOS
═══════════════════════════════════════════

1. Copiar `carnegie-pack/07_MIGRATION_0016_categories.sql` para `supabase/migrations/0016_categories.sql`. Aplicar.

2. `npm run db:types` para regenerar tipos.

A migration cria:
- Tabela `category_dimensions` (Perfil, Assunto, Aproximação - user pode criar mais)
- Tabela `categories` (opções dentro de cada dimensão, com cor opcional)
- Tabela `contact_categories` (junção many-to-many)
- View `v_contacts_with_categories` (contatos com categorias agregadas em JSON)
- Função `seed_carnegie_categories(user_id)` (já roda automaticamente pros users existentes via DO block no final do SQL)

═══════════════════════════════════════════
PARTE B — TIPOS DOMAIN
═══════════════════════════════════════════

3. Adicionar em `src/types/domain.ts`:

```typescript
export type CategoryColor = 
  | 'gray' | 'red' | 'orange' | 'yellow' | 'green' 
  | 'teal' | 'blue' | 'purple' | 'pink' | 'accent';

export interface CategoryDimension {
  id: string;
  label: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  dimensionId: string;
  dimensionLabel?: string;  // hidratado em queries
  dimensionSlug?: string;   // hidratado em queries
  label: string;
  slug: string;
  color: CategoryColor | null;
  description: string | null;
  sortOrder: number;
  archived: boolean;
  usageCount: number;
}

// extender Contact (já existe) com:
export interface Contact {
  // ... campos existentes
  categories?: Category[];  // hidratado quando vier da view
}

// Filtro estruturado usado nas views
export interface ContactFilter {
  search?: string;
  tier?: string[];
  phase?: string[];
  categoryIds?: string[];  // intersecção (AND): contato precisa ter TODAS as categorias listadas
  // OBS: dentro da mesma dimensão é OR, entre dimensões é AND
  // ex: [Investidor, Cliente, Impacto] = (Investidor OR Cliente) AND Impacto
  hasPromisesOverdue?: boolean;
  hasOpenReferrals?: boolean;
  archived?: boolean;
}
```

═══════════════════════════════════════════
PARTE C — SCHEMAS ZOD
═══════════════════════════════════════════

4. Criar `api/_schemas/category-dimension.ts`:
   - Zod schema com label, slug (regex `^[a-z0-9_-]+$`), description optional, sortOrder int
   - Mapper snake → camel

5. Criar `api/_schemas/category.ts`:
   - Zod schema com label, slug, color enum (lista fechada), dimensionId uuid, description optional, sortOrder int
   - Mapper

6. Criar `api/_schemas/contact-category.ts`:
   - Zod schema com contactId, categoryIds[] (array de uuids)
   - Endpoint usa pra setar/substituir categorias de um contato de uma vez

═══════════════════════════════════════════
PARTE D — ENDPOINTS API
═══════════════════════════════════════════

Todos com requireAuth, safeParse com 400+message, filtro user_id.

7. `api/category-dimensions-list.ts` (GET)
   - Retorna dimensions ordenadas por sort_order, archived=false por default
   - Query param `?includeArchived=true` opcional

8. `api/category-dimensions-save.ts` (POST)
   - Upsert: cria nova ou atualiza existente (id no body)
   - Slug deve ser único por user (já enforçado no DB unique)

9. `api/category-dimensions-archive.ts` (POST)
   - Body: { id, archived: boolean }
   - Soft delete

10. `api/categories-list.ts` (GET)
    - Retorna categorias com dimensão hidratada (JOIN)
    - Query params opcionais: `?dimensionId=uuid` ou `?dimensionSlug=perfil`
    - Default: archived=false

11. `api/categories-save.ts` (POST)
    - Upsert (id no body se update)

12. `api/categories-archive.ts` (POST)
    - Soft delete

13. `api/contacts-set-categories.ts` (POST) — **endpoint principal de atribuição**
    - Body: `{ contactId: uuid, categoryIds: uuid[] }`
    - Lógica: deleta contact_categories desse contato + insere as novas (em transação)
    - Retorna o contato atualizado com `categories` hidratado
    - **Importante:** validar que todas as categoryIds pertencem ao mesmo user_id

14. **Atualizar `api/contacts-list.ts`:**
    - Usar a view `v_contacts_with_categories` em vez da tabela `contacts` direta
    - Aceitar novos query params: `?categoryIds=uuid1,uuid2,uuid3`
    - Lógica do filtro: contato precisa ter pelo menos uma categoria de cada dimensão presente em categoryIds
    - Implementação SQL: agrupar categoryIds por dimensão (lookup), depois para cada dimensão: `WHERE EXISTS (SELECT 1 FROM contact_categories cc WHERE cc.contact_id = c.id AND cc.category_id IN (...))`
    - Múltiplos `EXISTS` com AND entre eles

═══════════════════════════════════════════
PARTE E — HOOKS / PROVIDER
═══════════════════════════════════════════

15. Criar `src/hooks/useCategoryDimensions.ts`:
    - { dimensions, loading, save, archive, refetch }
    - Cache simples, fetch on mount

16. Criar `src/hooks/useCategories.ts`:
    - { categories, loading, byDimension(slug|id), save, archive, refetch }
    - `byDimension` retorna lista filtrada para uso em dropdowns

17. **Atualizar `ContactsProvider`** (criado no PR 3):
    - Incluir `setContactCategories(contactId, categoryIds[])` no value
    - Após save, atualiza o cache local do contato (substitui `categories` array)

═══════════════════════════════════════════
PARTE F — COMPONENTE Chip reutilizável
═══════════════════════════════════════════

18. Criar `src/components/shared/CategoryChip.tsx`:
    - Props: `{ category: Category, onRemove?: () => void, size?: 'sm'|'md', clickable?: boolean, onClick?: () => void }`
    - Visual: padding pequeno, borda 1px, label, opcionalmente botão X para remover
    - **Cor:** usar CSS variables mapeadas. Ex: se color='blue', aplicar var(--chip-blue-bg) + var(--chip-blue-fg). Se color=null, neutro (border/var(--border), text/var(--fg)).

19. Adicionar em `src/styles/globals.css` as 10 paletas de chip:
    ```css
    --chip-gray-bg: ...      --chip-gray-fg: ...
    --chip-red-bg: ...       --chip-red-fg: ...
    --chip-orange-bg: ...    --chip-orange-fg: ...
    --chip-yellow-bg: ...    --chip-yellow-fg: ...
    --chip-green-bg: ...     --chip-green-fg: ...
    --chip-teal-bg: ...      --chip-teal-fg: ...
    --chip-blue-bg: ...      --chip-blue-fg: ...
    --chip-purple-bg: ...    --chip-purple-fg: ...
    --chip-pink-bg: ...      --chip-pink-fg: ...
    --chip-accent-bg: var(--accent)  --chip-accent-fg: var(--accent-ink)
    ```
    
    Usar tons suaves (background com baixa saturação ~15% lightness diff do fg). Light mode e dark mode com valores diferentes (já que body.dark muda variáveis). Manter coerência com a estética monocromática do app — chips são acentos visuais discretos, não festivos.

═══════════════════════════════════════════
PARTE G — CONTACTPANEL: aba Categorias
═══════════════════════════════════════════

20. Em `ContactPanel.tsx`, adicionar nova aba "Categorias":
    - Lista categorias atuais do contato (chips com X pra remover)
    - Agrupadas visualmente por dimensão (header da dimensão acima)
    - Botão "+ Adicionar" por dimensão abre dropdown/picker com categorias dessa dimensão (filtradas pelas que o contato ainda não tem)
    - Cada categoria selecionada chama `contactsProvider.setContactCategories(contactId, [...current, newId])`
    - Remover chip → `setContactCategories(contactId, current.filter(id => id !== removedId))`
    - Footer da aba: link "Gerenciar categorias..." → navega pra ConfigPage > Categorias

21. **Atualizar ContactCard** (componente que renderiza card de contato em ContactsList):
    - Mostrar até 3 chips da pessoa (priorizar Aproximação > Perfil > Assunto > resto)
    - Se tiver mais que 3, mostrar "+N" cinza

═══════════════════════════════════════════
PARTE H — FILTROS NAS VIEWS
═══════════════════════════════════════════

22. Criar `src/components/shared/FilterBar.tsx`:
    - Componente reutilizável que aparece sticky no topo das views
    - Props: 
      ```
      {
        value: ContactFilter,
        onChange: (filter: ContactFilter) => void,
        showTier?: boolean,
        showPhase?: boolean,
        showCategories?: boolean,
        showPromises?: boolean,
      }
      ```
    - Visual:
      - Linha horizontal de chips ATIVOS (cada chip representa um filtro, com X pra remover)
      - Botão "+ Filtro" à direita abre dropdown agrupado:
        - Por Dimensão (cada dimensão expande pra mostrar suas categorias com checkbox)
        - Tier (se showTier)
        - Phase (se showPhase)
        - Outros (overdue promises, open referrals)
      - Botão "Limpar" se houver filtros ativos
    - Estado local: persistir em localStorage com chave por view (`contacts:filter`, `pipeline:filter`, `promises:filter`)

23. **Aplicar FilterBar em ContactsList (subtab Lista de Contatos):**
    - Mostrar: tier, phase, categorias, hasPromisesOverdue
    - Filtro afeta a query do `useContacts` (estender `useContacts.refetch` pra aceitar filtros)
    - Resultado da contagem visível: "Mostrando 23 de 187 contatos"

24. **Aplicar FilterBar em PipelineView:**
    - Mostrar: categorias (tier menos relevante aqui), hasPromisesOverdue
    - Filtro afeta cada coluna do kanban (filtra os cards de cada fase)

25. **Aplicar FilterBar em PromisesView** (criar essa view se ainda não existir, fica em Tasks/Promessas — verificar como está implementado depois do PR 1):
    - Mostrar: categorias (filtra promessas por categorias do contato vinculado), tier
    - O endpoint que lista promessas (`tasks` filtrado por tag `#promessa`) precisa aceitar `?contactCategoryIds=...` e fazer JOIN com `contact_categories`

26. **Aplicar FilterBar em PulseView** (se já criado no PR 4) ou planejar para PR 4:
    - Filtros aplicam às seções: inner em atraso, strong em atraso, sinais
    - Particularmente útil pra "ver só promotores de impacto em atraso"

═══════════════════════════════════════════
PARTE I — UI DE GESTÃO EM CONFIG
═══════════════════════════════════════════

27. Em `ConfigPage.tsx`, adicionar seção "Categorias":
    - Lista de dimensões (cards/seções colapsáveis):
      - Header de cada dimensão: label + count de categorias + ações (editar, arquivar, expandir/colapsar)
      - Body: lista de categorias dentro com chip preview + ações (editar label, mudar cor, arquivar, reorder por drag-and-drop OPCIONAL — se complexo, deixa só botões up/down)
      - "+ Nova categoria" no fim de cada dimensão
    - Botão "+ Nova dimensão" no topo, abre modal:
      - Label, slug (auto-gerado do label mas editável), description
    - Modal de edit de categoria:
      - Label, slug, cor (10 botões coloridos pra escolher, + opção "sem cor"), descrição
      - Botão "Arquivar"

28. Permitir reorder das dimensões e categorias se conseguir implementar simples. Senão, sort_order edita via input number.

═══════════════════════════════════════════
PARTE J — TESTES E POLISH
═══════════════════════════════════════════

29. Testes:
    - Schemas Zod
    - Hook `useCategories.byDimension`
    - Render do CategoryChip com várias cores
    - FilterBar: toggle de filtro afeta value corretamente

30. **Onboarding**: o seed já roda automaticamente na migration. Mas adicionar um endpoint `api/categories-reseed.ts` que chama `seed_carnegie_categories(user_id)` — útil se o user apagou tudo e quer recomeçar.

31. **Validação final:** `npm test && npm run build`.

═══════════════════════════════════════════
CRITÉRIOS DE ACEITE
═══════════════════════════════════════════

- Aplicar a migration cria 3 dimensões + 12 categorias automaticamente pro user
- Em Config, posso criar nova dimensão "Setor" e adicionar categorias "Finanças", "Saúde", "Educação"
- Em Config, posso editar a cor da categoria "Investidor" para verde
- No ContactPanel, aba Categorias mostra chips agrupados por dimensão. Posso adicionar/remover múltiplas categorias.
- No ContactsList, vejo chips no card (top 3) e tenho FilterBar funcional. Filtrar por "Investidor + Impacto" retorna apenas contatos que são Investidor E também marcados com Impacto.
- No Pipeline, FilterBar filtra o kanban inteiro.
- No Promises (após PR 1 com tag promessa), FilterBar permite ver "promessas de pessoas categorizadas como Cliente".

═══════════════════════════════════════════
PADRÕES OBRIGATÓRIOS (do CLAUDE.md)
═══════════════════════════════════════════

- requireAuth em todo handler
- safeParse com 400 + issues[0].message
- Filtro user_id = user.id em todas as queries
- Imports .js em api/ (NodeNext)
- spread-conditional para opcionais
- Sem inline color hex no frontend, **somente CSS variables**
- Usar padrão existente de hooks (modelo CoachProvider) — se Provider único, atualizar cache local após mutation
- View `v_contacts_with_categories` pra lista de contatos com categorias hidratadas (evita N+1)
```

---

## Como integrar com o resto do pacote

### Onde encaixar na sequência

**Sequência ideal atualizada:**

```
PR 0 → PR 1 → PR 2 → PR 3 → Onda 1 SQL → [PR 8 categorias] → [PR 7 wizard] → PR 4 → PR 5 → PR 6
```

Recomendo PR 8 **antes** do PR 7 (wizard) porque:
- O wizard pode incluir uma 4ª pergunta opcional "Adicionar categorias?" se as categorias já existirem
- O wizard popula tier + hooks; categorias podem ser preenchidas no wizard ou depois

E **antes** do PR 4 (Pulso) porque o Pulso vai querer mostrar chips nos cards e ter FilterBar.

### Atualização do README do pacote

Adicione no README a entrada:

```
| 07 | 07_MIGRATION_0016_categories.sql | SQL: sistema de categorias multidimensionais com seed | Quando o PR 8 começar |
| 08 | 08_PROMPT_PR8_categories.md | Prompt do PR 8 - categorias + filtros | Após PR 3, antes de PR 4 |
```

### Atualização do briefing 00

Adicione na seção "Decisões já tomadas":
- **11. Categorias estruturadas em dimensões.** Não `tags[]` livre. 3 tabelas (`category_dimensions`, `categories`, `contact_categories`). Many-to-many. Cor opcional. Seed inicial 3 dimensões + 12 categorias.
- **12. `tags[]` legado mantido.** A coluna existente em `contacts` continua, mas não é mais a fonte primária. Pode virar onda 4 de onboarding (migrar tags pra categorias).

### Atualização do SPEC.md (no final, após todos PRs)

Adicione no §3 (Mapa de Módulos):
```
- Categories — dimensões/categorias customizáveis para classificar contatos, chips visuais, filtros multidimensionais nas views.
```

E novas linhas no §7 e §9.

---

## Mudanças no Wizard de onboarding (PR 7) se rodar depois deste

Se você fizer PR 8 antes do PR 7, atualize o prompt do PR 7 com:

> Adicionar Pergunta 4 (opcional) no wizard: "Adicionar categorias?" → dropdown agrupado por dimensão, multi-select de categorias para esse contato. Usa `useCategories.byDimension` e chama `contactsProvider.setContactCategories`.

---

## Variação minimalista (se você não quer todos os filtros agora)

Se quer só categorias mas pode pular FilterBar nas views:
- Implementar PARTES A-G (banco, tipos, endpoints, hooks, chip, ContactPanel aba)
- Pular PARTES H-I (FilterBar nas views, UI de gestão)
- UI de gestão básica em Config: simples lista, sem reorder, sem cor (deixa null por enquanto)
- Adiciona FilterBar depois quando sentir falta

Reduz o PR pela metade. Recomendo o completo se você for fazer mesmo.

---

*Fim do prompt PR 8.*
