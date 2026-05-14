-- ============================================================
-- Migration 0018 — Permitir includeArchived em v_contacts_with_categories
-- ============================================================
-- A view criada em 0016 tinha `where c.archived = false` hard-coded, o que
-- quebra qualquer endpoint que queira incluir arquivados (ex: hipotético
-- /contacts-list?includeArchived=true). O filtro de archived deve viver
-- no endpoint, não na view.
-- ============================================================

create or replace view v_contacts_with_categories as
select
  c.*,
  coalesce(
    jsonb_agg(
      distinct jsonb_build_object(
        'id', cat.id,
        'label', cat.label,
        'slug', cat.slug,
        'color', cat.color,
        'dimensionId', cat.dimension_id,
        'dimensionLabel', dim.label,
        'dimensionSlug', dim.slug
      )
    ) filter (where cat.id is not null),
    '[]'::jsonb
  ) as categories
from contacts c
left join contact_categories cc on cc.contact_id = c.id
left join categories cat on cat.id = cc.category_id and cat.archived = false
left join category_dimensions dim on dim.id = cat.dimension_id and dim.archived = false
group by c.id;
