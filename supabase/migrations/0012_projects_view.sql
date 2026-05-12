-- =============================================================
-- Migration 0012 — view v_projects_with_counts
-- Projects + agregados (task counts, child counts, resolved quadrant)
-- =============================================================

create or replace view public.v_projects_with_counts as
select
  p.*,
  coalesce((
    select count(*) from public.tasks t
    where t.project_id = p.id and t.archived = false and t.status not in ('done','cancelled')
  ), 0) as task_open_count,
  coalesce((
    select count(*) from public.tasks t
    where t.project_id = p.id and t.archived = false
  ), 0) as task_count,
  coalesce((
    select count(*) from public.projects c
    where c.parent_id = p.id and c.archived_at is null
  ), 0) as child_count,
  coalesce(p.quadrant_override, a.quadrant) as resolved_quadrant
from public.projects p
left join public.areas a on a.id = p.area_id;

comment on view public.v_projects_with_counts is
  'Projects + task counts + child count + resolved quadrant (override > area)';
