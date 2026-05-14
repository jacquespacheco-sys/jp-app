# JP App — Contatos · Pacote Carnegie
## 04 · Onboarding e migração de dados existentes

> **Por que isso existe:** depois das migrations 0014 e 0015, o banco tem colunas novas mas **vazias**. Sem dados classificados, Pulso fica em branco, Rituais não sabem quem pré-selecionar, e o app parece quebrado. Este doc cobre como popular esses dados de forma eficiente para a base existente de contatos.

---

## 1. Diagnóstico — o que você tem hoje

Pelo schema atual, cada contato tem:
- Nome, empresa, role, email, phone, address, birthday
- `phase` (prospect/first/talking/proposal/active/dormant) — sinal CRM
- `tags[]` (livres)
- `notes` (texto livre)
- `next_contact` (texto livre tipo "ligar semana que vem")
- Histórico de `interactions` (date, type, note)

E o que você precisa adicionar (Carnegie):
- `tier` (inner/strong/network/weak/dormant) — **crítico**
- `interests`, `conversation_hooks`, `what_they_value`, `their_goals`, `family` — **lento de preencher**
- `preferred_channel`, `linkedin_url`, etc — **fácil de preencher**
- `first_met_at`, `company_start_date` — alimentam datas derivadas

**A pergunta certa:** quanto disso o sistema consegue inferir sozinho, e quanto precisa de você?

---

## 2. Estratégia em 3 ondas

### Onda 1 — SQL automático (10 minutos, zero esforço seu)
Inferência por dados existentes:
- **`tier` por phase + recência de interação:**
  - `phase=active` + interagiu nos últimos 30d → candidato `strong`
  - `phase=dormant` ou sem interação há 180d+ → `dormant`
  - `tags` contém "família" / "family" / "esposa" / etc → `inner`
  - `tags` contém "sócio" / "partner" → `inner`
  - resto → null (você refina depois)

- **`cadence_days`:** deixa null — usa o default do tier

- **`preferred_channel`:** infere pelo tipo de última interação (se tudo é WhatsApp → whatsapp; se misto → null)

- **`first_met_at`:** se há `interactions`, pega a data da mais antiga

- **`last_interaction_at`:** populado automaticamente pelo trigger da migration 0014, mas para os históricos é preciso rodar uma vez (script faz isso)

- **`source_contact_id`:** se `notes` contém "indicado por X" — fica pra refinar manualmente, complicado regex-ar nome próprio

- **`special_dates` derivadas:** para cada contato com `birthday` no formato DD/MM, garantir que tem uma entrada `celebrate`. Para os que têm `company_start_date` (se você preencheu), criar STATE-versary.

### Onda 2 — Revisão guiada (30-60 minutos)
Tela one-time no app: você passa por cada contato, decide o tier final, e adiciona 1-3 hooks de conversa. **Esse é o passo que faz diferença na qualidade do Pulso.**

Heurística sugerida durante revisão:
- "Se eu morresse semana que vem, queria que essa pessoa soubesse?" → **inner**
- "Tenho contato regular e troco favores?" → **strong**
- "Conheço bem, mas o contato é esporádico?" → **network**
- "Conheço de eventos/LinkedIn, raramente interajo?" → **weak**
- "Já fui próximo, hoje sumimos?" → **dormant**

### Onda 3 — Refinamento orgânico (uso real)
Não tenta preencher tudo de uma vez. Conforme você interage com cada pessoa, você completa o Carnegie panel daquela pessoa. Em 2-3 meses de uso, os contatos `inner` e `strong` ficam ricos; o resto pode permanecer minimalista — e tudo bem.

---

## 3. Quanto cada onda popula

Estimativa para ~200 contatos típicos (números fictícios mas calibrados):

| Onda | Esforço seu | Cobertura tier | Cobertura Carnegie (hooks/goals/values) |
|---|---|---|---|
| Onda 1 (SQL auto) | 10 min | ~40% (família+ativos óbvios) | 0% |
| Onda 2 (wizard) | 30-60 min | ~95% | ~30% (só inner+strong) |
| Onda 3 (uso) | contínuo | ~99% | sobe ao longo de 90d |

A onda 2 é a alta-alavancagem. Se você fizer ela em uma sentada, o Pulso vira útil imediatamente.

---

## 4. Quando rodar cada onda

```
[migration 0014 aplicada]
        ↓
[Onda 1: SQL automático]  ← rode aqui, antes mesmo da UI
        ↓
[PR 1-3 do pacote Carnegie aplicados]
        ↓
[Onda 2: wizard de revisão]  ← assim que PR 3 estiver mergeado, antes de PR 4 (Pulso)
        ↓
[PR 4-5 do pacote]
        ↓
[Onda 3: orgânico]  ← uso diário
```

**Por que essa ordem:** rodar a Onda 2 antes do Pulso evita o frustração de abrir Pulso e ver lista vazia ou caótica. Você abre o Pulso já com tiers preenchidos e contatos pré-classificados.

---

## 5. Plano operacional (passo a passo)

### Passo 1 — Após aplicar migration 0014

Abra `carnegie-pack/05_SQL_initial_classification.sql`, leia o que ele faz, e rode no **SQL Editor do Supabase** (não na CLI — você quer ver o resultado linha a linha).

O script é **idempotente**: pode rodar de novo sem efeito colateral. Cada bloco tem `WHERE` que evita sobrescrever decisões manuais futuras.

Resultado esperado:
- ~30-50% dos contatos classificados em algum tier
- 100% dos contatos com `last_interaction_at` populado (se tiverem interações)
- `birthdays` viraram entradas em `special_dates` automaticamente
- `first_met_at` derivado da interação mais antiga

### Passo 2 — Verificar manualmente o resultado da Onda 1

No SQL editor, rode:

```sql
-- Distribuição de tiers após Onda 1
select tier, count(*) from contacts where archived = false group by tier;

-- Inner e Strong identificados (auditoria visual)
select first_name, last_name, company, tier, phase, last_interaction_at, tags
from contacts
where tier in ('inner', 'strong')
order by tier, last_interaction_at desc;

-- Datas especiais geradas
select count(*) from special_dates where source like 'derived_%';
```

Se algum contato apareceu como `inner` errado (ex: você marcou "família" como tag em alguém da empresa), corrige inline:
```sql
update contacts set tier = 'strong' where id = 'uuid-aqui';
```

### Passo 3 — Implementar PRs 1-3 do pacote Carnegie

Seguir `03_PROMPTS_CLAUDE_CODE.md` normalmente.

### Passo 4 — Após PR 3, implementar o Wizard de revisão (PR 7, opcional)

Ver `carnegie-pack/06_PROMPT_PR7_onboarding_wizard.md`. É um PR pequeno (1-2h pro Claude Code) mas faz toda a diferença no resultado final.

Alternativa **se você não quiser implementar o wizard**: passe pela lista de contatos no app (já existe), abra cada um, escolha tier no dropdown (vai existir após PR 3), preencha 1-3 hooks. Mais manual, mas funciona.

### Passo 5 — Onda 3 (uso real)

Daqui pra frente, conforme você interage:
- Toda vez que registrar interação importante: 30 segundos para adicionar 1 hook de conversa novo
- Toda vez que abrir Pulso e ver alguém em atraso: se o card está "magro" (sem hook), atualize antes de mandar a mensagem
- Mensalmente: revise contatos `dormant` — algum deveria virar `network`?

---

## 6. Riscos e como mitigar

### Risco 1 — Classificar muita gente como `inner`
Limite Dunbar é 5. Se você tem 20 em inner, ninguém é inner de verdade.
**Mitigação:** o wizard mostra contador "inner: N/5" no topo. Quando passar de 5, força você a recalibrar.

### Risco 2 — Não preencher hooks e ficar com cards sem contexto
Pulso fica menos útil. Aí você desiste.
**Mitigação:** o wizard pede 1 hook obrigatório para inner+strong. O resto pode pular.

### Risco 3 — Sobrescrever decisões com re-runs do SQL
O script de Onda 1 tem `WHERE tier IS NULL` em todos os updates de tier. Roda quantas vezes quiser — não toca em quem você já classificou. Mesmo para `special_dates`, usa `ON CONFLICT DO NOTHING` ou check de existência.

### Risco 4 — Birthdays em formatos diferentes (DD/MM vs DD-MM vs DD/MM/YYYY)
O schema atual valida `^\d{2}/\d{2}$`. Se há dados sujos, o INSERT vai falhar.
**Mitigação:** script tem uma query de auditoria antes do INSERT, te mostra quais birthdays estão fora do padrão para você arrumar antes.

---

## 7. Exportação antes de qualquer coisa

**Faz backup antes.** Mesmo o Supabase tendo backups automáticos.

```bash
# CLI
supabase db dump --linked --schema public > backup-pre-carnegie-$(date +%Y%m%d).sql

# OU pelo dashboard
# Database → Backups → Create snapshot
```

Se algo der errado na Onda 1, você restora do snapshot em 30 segundos.

---

## 8. Checklist final

Antes de começar a Onda 1:
- [ ] Migration 0014 aplicada
- [ ] `npm run db:types` rodado
- [ ] Backup feito (snapshot Supabase)
- [ ] Acesso ao SQL Editor do dashboard Supabase

Após Onda 1:
- [ ] Distribuição de tiers checada
- [ ] Birthdays fora de padrão arrumados
- [ ] Inner/strong revisados manualmente
- [ ] Special_dates auto-geradas conferidas

Após Onda 2 (wizard):
- [ ] Todos os contatos passaram pelo wizard ou foram marcados como "weak" por padrão
- [ ] Inner ≤ 5 contatos
- [ ] Strong tem hooks preenchidos

---

*Próximo arquivo: `05_SQL_initial_classification.sql` (script SQL para Onda 1).*
*Opcional: `06_PROMPT_PR7_onboarding_wizard.md` (PR pro Claude Code criar o wizard de revisão).*
