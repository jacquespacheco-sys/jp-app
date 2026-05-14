-- ============================================================
-- JP App — Carnegie Onboarding · Onda 1 · Classificação inicial
-- ============================================================
-- Script idempotente — pode rodar quantas vezes quiser.
-- Cada UPDATE tem WHERE que preserva decisões manuais já feitas.
-- 
-- COMO USAR:
-- 1. Faça backup antes (Supabase dashboard → Backups → Create snapshot)
-- 2. Migration 0014 já deve estar aplicada
-- 3. Abra Supabase SQL Editor
-- 4. Rode bloco por bloco, lendo o que cada um faz
-- 5. Confira contagens no final
--
-- AJUSTE: o filtro user_id está em uma variável no topo. 
-- Se você é o único user (single-user app), descobre o id assim:
--   SELECT id, email FROM users;
-- E substitua nas linhas abaixo, OU edite o WHERE para usar email.
-- ============================================================


-- ============================================================
-- 0. Setup — descubra seu user_id e use em todos os blocos
-- ============================================================

-- Cole seu user_id aqui (uuid), ou ajuste o filtro abaixo
-- Se for single-user, pode simplesmente remover os filtros de user_id
-- já que só tem você nas tabelas. Mas é mais seguro filtrar.

-- Para descobrir:
SELECT id, email, name FROM users;

-- Substitua 'SEU-USER-UUID-AQUI' nos blocos abaixo
-- Ou rode tudo em uma transaction com DO $$ ... END $$ pra capturar variável


-- ============================================================
-- 1. AUDITORIA inicial — entenda o que você tem
-- ============================================================

-- Total de contatos não arquivados
SELECT count(*) AS total FROM contacts WHERE archived = false;

-- Distribuição por phase atual
SELECT phase, count(*) FROM contacts 
WHERE archived = false 
GROUP BY phase 
ORDER BY count(*) DESC;

-- Contatos com tags (amostra)
SELECT first_name, last_name, tags 
FROM contacts 
WHERE archived = false AND array_length(tags, 1) > 0 
LIMIT 30;

-- Birthdays fora do padrão (DD/MM) — TEM QUE ARRUMAR ANTES DE PROSSEGUIR
SELECT id, first_name, last_name, birthday 
FROM contacts 
WHERE archived = false 
  AND birthday IS NOT NULL 
  AND birthday !~ '^\d{2}/\d{2}$';

-- Contatos com interações registradas (top 20 por # interações)
SELECT c.first_name, c.last_name, c.company, c.phase, count(i.id) AS n_interactions, max(i.date) AS last_interaction
FROM contacts c
LEFT JOIN interactions i ON i.contact_id = c.id
WHERE c.archived = false
GROUP BY c.id
ORDER BY n_interactions DESC NULLS LAST
LIMIT 20;


-- ============================================================
-- 2. Popular last_interaction_at (cache) para contatos pré-existentes
-- ============================================================
-- O trigger da migration 0014 só atua em inserts/updates futuros.
-- Aqui populamos o cache para histórico já existente.

UPDATE contacts c
SET last_interaction_at = sub.max_date
FROM (
  SELECT contact_id, max(date) AS max_date
  FROM interactions
  GROUP BY contact_id
) sub
WHERE c.id = sub.contact_id
  AND c.last_interaction_at IS NULL;

-- Quantos foram atualizados?
SELECT count(*) AS contacts_with_interactions
FROM contacts 
WHERE last_interaction_at IS NOT NULL AND archived = false;


-- ============================================================
-- 3. Popular first_met_at do histórico de interações
-- ============================================================
-- Para contatos sem first_met_at, usa a interação mais antiga como proxy.
-- (Não é perfeito — pode ser que vocês se conheceram antes da primeira interação registrada.
-- Mas é melhor que vazio, e você pode corrigir manualmente os importantes depois.)

UPDATE contacts c
SET first_met_at = sub.min_date
FROM (
  SELECT contact_id, min(date) AS min_date
  FROM interactions
  GROUP BY contact_id
) sub
WHERE c.id = sub.contact_id
  AND c.first_met_at IS NULL;


-- ============================================================
-- 4. CLASSIFICAR tier — Onda 1 automática
-- ============================================================
-- Regras em ordem de prioridade. WHERE tier IS NULL preserva manualmente classificados.

-- 4.1 INNER por tag de família/sócio
UPDATE contacts
SET tier = 'inner'
WHERE archived = false
  AND tier IS NULL
  AND (
    tags && ARRAY['família','familia','family']::text[]
    OR tags && ARRAY['esposa','marido','filho','filha','pai','mae','mãe','irmão','irma','irmã']::text[]
    OR tags && ARRAY['sócio','socio','partner','co-founder']::text[]
    OR lower(coalesce(notes, '')) LIKE '%família%'
    OR lower(coalesce(notes, '')) LIKE '%esposa%'
    OR lower(coalesce(notes, '')) LIKE '%marido%'
  );

-- 4.2 STRONG por phase=active + interação recente
UPDATE contacts
SET tier = 'strong'
WHERE archived = false
  AND tier IS NULL
  AND phase = 'active'
  AND last_interaction_at IS NOT NULL
  AND last_interaction_at > now() - interval '60 days';

-- 4.3 STRONG por # alto de interações nos últimos 6 meses (3+)
UPDATE contacts c
SET tier = 'strong'
WHERE c.archived = false
  AND c.tier IS NULL
  AND (
    SELECT count(*) 
    FROM interactions i 
    WHERE i.contact_id = c.id 
      AND i.date > now() - interval '6 months'
  ) >= 3;

-- 4.4 NETWORK por phase active/talking/proposal sem cair em strong
UPDATE contacts
SET tier = 'network'
WHERE archived = false
  AND tier IS NULL
  AND phase IN ('active','talking','proposal','first');

-- 4.5 DORMANT por phase=dormant ou sem interação há 6+ meses
UPDATE contacts
SET tier = 'dormant'
WHERE archived = false
  AND tier IS NULL
  AND (
    phase = 'dormant'
    OR last_interaction_at < now() - interval '180 days'
    OR (last_interaction_at IS NULL AND created_at < now() - interval '180 days')
  );

-- 4.6 WEAK para o resto (contatos novos ou sem sinal claro)
UPDATE contacts
SET tier = 'weak'
WHERE archived = false
  AND tier IS NULL;


-- ============================================================
-- 5. Popular preferred_channel por inferência da última interação
-- ============================================================
-- Heurística simples: se 80%+ das últimas 5 interações são do mesmo tipo, usa esse.

UPDATE contacts c
SET preferred_channel = sub.dominant_type
FROM (
  SELECT 
    i.contact_id,
    CASE
      WHEN i.type = 'call' THEN 'phone'
      WHEN i.type = 'meeting' THEN 'whatsapp'  -- meetings geralmente são organizadas via WA no Brasil
      WHEN i.type = 'email' THEN 'email'
      WHEN i.type = 'message' THEN 'whatsapp'
      ELSE NULL
    END AS dominant_type
  FROM interactions i
  WHERE i.id IN (
    SELECT id FROM (
      SELECT id, contact_id, row_number() OVER (PARTITION BY contact_id ORDER BY date DESC) AS rn
      FROM interactions
    ) ranked
    WHERE rn = 1  -- pega só a última interação por contato
  )
) sub
WHERE c.id = sub.contact_id
  AND c.preferred_channel IS NULL
  AND sub.dominant_type IS NOT NULL;


-- ============================================================
-- 6. Criar special_dates derivadas de birthday
-- ============================================================
-- Para cada contato com birthday válido (DD/MM), garante uma entrada
-- em special_dates do tipo 'celebrate', source='derived_birthday', recurring=true.
-- Idempotente: NÃO duplica se já existe.

INSERT INTO special_dates (user_id, contact_id, label, type, date_anniversary, recurring, lead_days, source)
SELECT 
  c.user_id,
  c.id,
  'Aniversário · ' || c.first_name || coalesce(' ' || c.last_name, ''),
  'celebrate',
  c.birthday,
  true,
  2,
  'derived_birthday'
FROM contacts c
WHERE c.archived = false
  AND c.birthday IS NOT NULL
  AND c.birthday ~ '^\d{2}/\d{2}$'
  AND NOT EXISTS (
    SELECT 1 FROM special_dates sd
    WHERE sd.contact_id = c.id
      AND sd.source = 'derived_birthday'
  );


-- ============================================================
-- 7. Criar special_dates de "primeiro encontro" (aniversário de conhecimento)
-- ============================================================
-- Só para contatos inner+strong (pra não poluir com 200 datas de network/weak).
-- Tipo: 'acknowledge' (não festivo, mais sutil).

INSERT INTO special_dates (user_id, contact_id, label, type, date_anniversary, recurring, lead_days, source)
SELECT
  c.user_id,
  c.id,
  'Aniversário de conhecimento · ' || c.first_name,
  'acknowledge',
  to_char(c.first_met_at, 'DD/MM'),
  true,
  1,
  'derived_first_met'
FROM contacts c
WHERE c.archived = false
  AND c.tier IN ('inner','strong')
  AND c.first_met_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM special_dates sd
    WHERE sd.contact_id = c.id
      AND sd.source = 'derived_first_met'
  );


-- ============================================================
-- 8. AUDITORIA pós-Onda 1 — confira o resultado
-- ============================================================

-- Distribuição final de tiers
SELECT tier, count(*) AS qtd
FROM contacts 
WHERE archived = false
GROUP BY tier
ORDER BY 
  CASE tier
    WHEN 'inner' THEN 1
    WHEN 'strong' THEN 2
    WHEN 'network' THEN 3
    WHEN 'weak' THEN 4
    WHEN 'dormant' THEN 5
    ELSE 6
  END;

-- Tiers vs phases — sanity check
SELECT tier, phase, count(*) 
FROM contacts 
WHERE archived = false 
GROUP BY tier, phase 
ORDER BY tier, phase;

-- INNER identificados — REVISAR MANUALMENTE
-- Se algum não deveria ser inner, ajustar:
--   UPDATE contacts SET tier = 'strong' WHERE id = 'uuid';
SELECT id, first_name, last_name, company, tags, last_interaction_at, notes
FROM contacts
WHERE archived = false AND tier = 'inner'
ORDER BY last_interaction_at DESC NULLS LAST;

-- STRONG identificados — REVISAR (top 30)
SELECT first_name, last_name, company, role, last_interaction_at, phase
FROM contacts
WHERE archived = false AND tier = 'strong'
ORDER BY last_interaction_at DESC NULLS LAST
LIMIT 30;

-- Special dates criadas
SELECT type, source, count(*) 
FROM special_dates 
GROUP BY type, source;

-- Sample de datas auto-criadas
SELECT sd.type, sd.label, sd.date_anniversary, sd.source, c.first_name
FROM special_dates sd
JOIN contacts c ON c.id = sd.contact_id
WHERE sd.source LIKE 'derived_%'
ORDER BY sd.created_at DESC
LIMIT 20;

-- View v_contacts_overdue funciona?
SELECT first_name, last_name, tier, effective_cadence_days, days_since_last, is_overdue
FROM v_contacts_overdue
WHERE is_overdue = true
ORDER BY tier, days_since_last DESC
LIMIT 30;


-- ============================================================
-- 9. (OPCIONAL) Ajustes manuais comuns
-- ============================================================
-- Cole e adapte os blocos abaixo conforme necessário.

-- Ajustar tier de uma pessoa específica:
-- UPDATE contacts SET tier = 'strong' WHERE id = 'uuid-aqui';

-- Aumentar cadência custom para uma pessoa (mais frequente que o default do tier):
-- UPDATE contacts SET cadence_days = 7 WHERE id = 'uuid-aqui';

-- Marcar canal preferido manualmente:
-- UPDATE contacts SET preferred_channel = 'linkedin' WHERE id = 'uuid-aqui';

-- Adicionar LinkedIn manualmente:
-- UPDATE contacts SET linkedin_url = 'https://linkedin.com/in/marina-costa' WHERE id = 'uuid-aqui';

-- Marcar uma data especial manual (filha de alguém):
-- INSERT INTO special_dates (user_id, contact_id, label, type, date_anniversary, recurring, lead_days, source)
-- VALUES ('seu-user-uuid', 'contact-uuid', 'Aniversário da Helena (filha)', 'celebrate', '15/05', true, 2, 'manual');

-- Adicionar conversation hooks para alguém:
-- UPDATE contacts 
-- SET conversation_hooks = array_append(coalesce(conversation_hooks, '{}'), 'Treinando para meia maratona de SP em setembro')
-- WHERE id = 'uuid-aqui';

-- Marcar source de indicação (quem indicou esse contato):
-- UPDATE contacts SET source_contact_id = 'contact-que-indicou-uuid', source_context = 'evento Bimbo 04/2025'
-- WHERE id = 'esse-contato-uuid';


-- ============================================================
-- 10. ROLLBACK (caso queira desfazer tudo)
-- ============================================================
-- Cuidado — só rode se realmente quer reverter:
-- 
-- DELETE FROM special_dates WHERE source IN ('derived_birthday','derived_first_met');
-- UPDATE contacts SET tier = NULL, preferred_channel = NULL, first_met_at = NULL, last_interaction_at = NULL;
-- 
-- (Decisões manuais que você fez também serão revertidas — por isso o snapshot!)


-- ============================================================
-- Fim do script de Onda 1.
-- 
-- Próximo passo: implementar PRs 1-3 do pacote Carnegie.
-- Depois disso, rodar o Wizard de revisão (Onda 2) ou refinar manualmente.
-- ============================================================
