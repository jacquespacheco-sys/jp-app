-- =============================================================
-- JP APP — Migration 0010: schema AQAL + GTD (aditivo)
-- Adiciona estruturas pra modelo AQAL (quadrantes I/IT/WE/ITS) +
-- GTD (horizontes H0..H5, status, contexto, energia, recorrência)
-- SEM destruir tabelas existentes. Compatível com módulos Notes,
-- News, Contacts e a integração Google Tasks já presentes.
-- =============================================================

-- -------------------------------------------------------------
-- ENUMs (criados se ainda não existirem)
-- -------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'quadrant') then
    create type public.quadrant as enum ('I','IT','WE','ITS');
  end if;
  if not exists (select 1 from pg_type where typname = 'horizon_lvl') then
    create type public.horizon_lvl as enum ('H0','H1','H2','H3','H4','H5');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_context') then
    create type public.task_context as enum ('deep','shallow','social','criativo','somatico','offline');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_kind') then
    create type public.project_kind as enum ('outcome','evergreen');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_status_aqal') then
    create type public.project_status_aqal as enum ('active','on_hold','someday','done','archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'habit_dose') then
    create type public.habit_dose as enum ('full','min','skip');
  end if;
  if not exists (select 1 from pg_type where typname = 'coach_kind') then
    create type public.coach_kind as enum ('briefing','check_in','callout','celebration','chat','review');
  end if;
  if not exists (select 1 from pg_type where typname = 'memory_kind') then
    create type public.memory_kind as enum ('fact','pattern','promise','concern','preference');
  end if;
  if not exists (select 1 from pg_type where typname = 'capture_src') then
    create type public.capture_src as enum ('manual','voice','email','briefing','coach','google');
  end if;
end $$;

-- task_status fica como text com check (permite valores legados 'doing'/'blocked')
-- assim não quebra dados nem código existente. Os novos valores são aceitos
-- pelo mesmo column.
do $$ begin
  if not exists (select 1 from information_schema.table_constraints
                 where table_name='tasks' and constraint_name='tasks_status_aqal_check') then
    alter table public.tasks
      add constraint tasks_status_aqal_check check (
        status in (
          'inbox','next','doing','blocked','done',
          'waiting','scheduled','someday','cancelled'
        )
      );
  end if;
end $$;

-- -------------------------------------------------------------
-- Trigger genérico updated_at (criado se não existir)
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- -------------------------------------------------------------
-- AREAS (H2)
-- -------------------------------------------------------------
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.areas(id) on delete set null,
  name text not null,
  slug text not null,
  quadrant public.quadrant not null,
  vision_h4 text,
  color text,
  icon text,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);
create index if not exists areas_user_active_idx on public.areas (user_id) where archived_at is null;
create index if not exists areas_parent_idx on public.areas (parent_id);

drop trigger if exists areas_updated_at on public.areas;
create trigger areas_updated_at before update on public.areas
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- PROJECTS — adiciona colunas AQAL/GTD (mantém name/color/google_*)
-- -------------------------------------------------------------
alter table public.projects
  add column if not exists area_id uuid references public.areas(id) on delete set null,
  add column if not exists parent_id uuid references public.projects(id) on delete cascade,
  add column if not exists title text,
  add column if not exists outcome text,
  add column if not exists kind public.project_kind not null default 'outcome',
  add column if not exists status_aqal public.project_status_aqal not null default 'active',
  add column if not exists quadrant_override public.quadrant,
  add column if not exists horizon public.horizon_lvl not null default 'H1',
  add column if not exists target_date date,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists position int not null default 0,
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz;

-- Copia name -> title em projects existentes que ainda não têm title
update public.projects set title = name where title is null;

-- Trigger: novos inserts de projects sem title herdam de name
create or replace function public.projects_title_fallback()
returns trigger language plpgsql as $$
begin
  if new.title is null then new.title := new.name; end if;
  return new;
end $$;

drop trigger if exists projects_title_fallback_trigger on public.projects;
create trigger projects_title_fallback_trigger before insert or update on public.projects
  for each row execute function public.projects_title_fallback();

create index if not exists projects_area_idx on public.projects (area_id);
create index if not exists projects_parent_idx on public.projects (parent_id);

-- -------------------------------------------------------------
-- TASKS — adiciona colunas AQAL/GTD (mantém priority/tags/depends_on)
-- -------------------------------------------------------------
alter table public.tasks
  add column if not exists area_id uuid references public.areas(id) on delete set null,
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade,
  add column if not exists quadrant_override public.quadrant,
  add column if not exists context public.task_context,
  add column if not exists energy smallint check (energy is null or (energy between 1 and 5)),
  add column if not exists time_estimate_min int,
  add column if not exists waiting_for text,
  add column if not exists due_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists rrule text,
  add column if not exists rrule_parent_id uuid references public.tasks(id) on delete set null,
  add column if not exists source public.capture_src not null default 'manual',
  add column if not exists external_id text,
  add column if not exists "position" int not null default 0,
  add column if not exists ai_classified boolean not null default false;

-- Copia due_date -> due_at em tasks existentes que ainda não têm due_at
update public.tasks set due_at = due_date::timestamptz where due_at is null and due_date is not null;

-- Trigger: sincroniza due_at <-> due_date e marca completed_at em status=done
create or replace function public.tasks_aqal_sync()
returns trigger language plpgsql as $$
begin
  -- Espelha due_date <-> due_at em qualquer direção
  if new.due_at is null and new.due_date is not null then
    new.due_at := new.due_date::timestamptz;
  elsif new.due_date is null and new.due_at is not null then
    new.due_date := new.due_at::date;
  end if;
  -- Marca completed_at automaticamente quando vai pra done
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' and new.completed_at is not null and tg_op = 'UPDATE' then
    new.completed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists tasks_aqal_sync_trigger on public.tasks;
create trigger tasks_aqal_sync_trigger before insert or update on public.tasks
  for each row execute function public.tasks_aqal_sync();

create index if not exists tasks_user_open_idx on public.tasks (user_id, status)
  where status in ('inbox','next','waiting','scheduled','doing');
create index if not exists tasks_area_idx on public.tasks (area_id);
create index if not exists tasks_due_at_idx on public.tasks (user_id, due_at)
  where status not in ('done','cancelled');
create index if not exists tasks_rrule_parent_idx on public.tasks (rrule_parent_id);

-- -------------------------------------------------------------
-- BRIEFINGS — adiciona colunas AQAL (mantém date/highlight/content)
-- -------------------------------------------------------------
alter table public.briefings
  add column if not exists briefed_for date,
  add column if not exists content_md text,
  add column if not exists context_snapshot jsonb,
  add column if not exists external_tasks_count int not null default 0,
  add column if not exists model_used text,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz;

-- Backfill: briefed_for = date, model_used = model, delivered_at = email_sent_at OR created_at
update public.briefings set
  briefed_for = coalesce(briefed_for, date),
  model_used = coalesce(model_used, model),
  delivered_at = coalesce(delivered_at, email_sent_at, created_at)
where briefed_for is null or model_used is null or delivered_at is null;

-- -------------------------------------------------------------
-- TAGS (genéricas, separadas de note_tags)
-- -------------------------------------------------------------
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.tags(id) on delete set null,
  name text not null,
  slug text not null,
  color text,
  icon text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.task_tags (
  task_id uuid not null references public.tasks(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (task_id, tag_id)
);
create index if not exists task_tags_tag_idx on public.task_tags (tag_id);

create table if not exists public.project_tags (
  project_id uuid not null references public.projects(id) on delete cascade,
  tag_id     uuid not null references public.tags(id) on delete cascade,
  primary key (project_id, tag_id)
);
create index if not exists project_tags_tag_idx on public.project_tags (tag_id);

-- -------------------------------------------------------------
-- HÁBITOS + RITUAIS
-- -------------------------------------------------------------
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  area_id uuid references public.areas(id) on delete set null,
  identity text not null,
  title text not null,
  action text not null,
  min_dose text not null,
  cue text,
  reward text,
  quadrant public.quadrant not null,
  cadence jsonb not null,
  schedule_time time,
  stack_after_habit_id uuid references public.habits(id) on delete set null,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists habits_user_active_idx on public.habits (user_id) where active;

drop trigger if exists habits_updated_at on public.habits;
create trigger habits_updated_at before update on public.habits
  for each row execute function public.set_updated_at();

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  done_on date not null,
  done_at timestamptz not null default now(),
  dose public.habit_dose not null,
  note text,
  unique (habit_id, done_on)
);
create index if not exists habit_logs_user_day_idx on public.habit_logs (user_id, done_on desc);

create table if not exists public.rituals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  trigger_time time,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists rituals_updated_at on public.rituals;
create trigger rituals_updated_at before update on public.rituals
  for each row execute function public.set_updated_at();

create table if not exists public.ritual_steps (
  id uuid primary key default gen_random_uuid(),
  ritual_id uuid not null references public.rituals(id) on delete cascade,
  position int not null,
  habit_id uuid references public.habits(id) on delete cascade,
  custom_step text,
  estimated_min int,
  unique (ritual_id, position),
  check (habit_id is not null or custom_step is not null)
);

-- -------------------------------------------------------------
-- INBOX (captura GTD)
-- -------------------------------------------------------------
create table if not exists public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  raw_text text not null,
  source public.capture_src not null,
  external_ref text,
  ai_suggestion jsonb,
  processed boolean not null default false,
  processed_to_task uuid references public.tasks(id) on delete set null,
  processed_to_project uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists inbox_user_pending_idx on public.inbox_items (user_id, created_at desc)
  where not processed;

-- -------------------------------------------------------------
-- EXTERNAL TASKS (cache read-only Google Tasks de outras contas)
-- -------------------------------------------------------------
create table if not exists public.external_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'google_tasks',
  external_list_id text not null,
  external_list_name text,
  external_id text not null,
  title text not null,
  notes text,
  status text not null,
  due_at timestamptz,
  completed_at timestamptz,
  last_synced_at timestamptz not null default now(),
  unique (user_id, provider, external_id)
);
create index if not exists external_tasks_open_idx on public.external_tasks (user_id, status, due_at);

-- -------------------------------------------------------------
-- INTEGRATIONS (genérico — Google Tasks já existe via users.google_refresh_token)
-- -------------------------------------------------------------
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  account_email text,
  scopes text[] not null default '{}',
  access_token_secret_id uuid,
  refresh_token_secret_id uuid,
  expires_at timestamptz,
  status text not null default 'active',
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, account_email)
);

drop trigger if exists integrations_updated_at on public.integrations;
create trigger integrations_updated_at before update on public.integrations
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- AI COACH
-- -------------------------------------------------------------
create table if not exists public.coach_profile (
  user_id uuid primary key references public.users(id) on delete cascade,
  name text not null default 'Coach',
  tone text not null default 'firme-mas-gentil',
  voice_examples text,
  values_md jsonb not null default '[]'::jsonb,
  boundaries text,
  check_in_schedule jsonb not null default '{}'::jsonb,
  system_prompt_override text,
  north_star_md text,
  h3_goals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists coach_profile_updated_at on public.coach_profile;
create trigger coach_profile_updated_at before update on public.coach_profile
  for each row execute function public.set_updated_at();

create table if not exists public.coach_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind public.memory_kind not null,
  content text not null,
  source text,
  related_area_id uuid references public.areas(id) on delete set null,
  related_project_id uuid references public.projects(id) on delete set null,
  related_task_id uuid references public.tasks(id) on delete set null,
  relevance smallint not null default 50 check (relevance between 0 and 100),
  expires_at timestamptz,
  last_referenced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists coach_memory_relevance_idx on public.coach_memory (user_id, kind, relevance desc);

create table if not exists public.coach_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind public.coach_kind not null,
  direction text not null check (direction in ('coach_to_user','user_to_coach')),
  content_md text not null,
  context_snapshot jsonb,
  resulted_in jsonb,
  model_used text,
  tokens_in int,
  tokens_out int,
  created_at timestamptz not null default now()
);
create index if not exists coach_log_user_recent_idx on public.coach_log (user_id, created_at desc);

-- -------------------------------------------------------------
-- WEEKLY REVIEWS
-- -------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  quadrant_distribution jsonb not null,
  habit_completion jsonb not null,
  metrics jsonb not null,
  alerts jsonb not null default '[]'::jsonb,
  insights_md text,
  model_used text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- -------------------------------------------------------------
-- VIEWS — quadrante resolvido + distribuição AQAL 7d
-- task.quadrant_override > project.quadrant_override > area.quadrant
-- -------------------------------------------------------------
create or replace view public.v_tasks_resolved as
select
  t.*,
  coalesce(t.quadrant_override, p.quadrant_override, a.quadrant) as resolved_quadrant
from public.tasks t
left join public.projects p on p.id = t.project_id
left join public.areas a on a.id = coalesce(t.area_id, p.area_id);

create or replace view public.v_quadrant_last_7d as
select
  user_id,
  resolved_quadrant,
  count(*) filter (where completed_at >= now() - interval '7 days') as completed,
  coalesce(sum(time_estimate_min) filter (where completed_at >= now() - interval '7 days'), 0) as minutes
from public.v_tasks_resolved
where resolved_quadrant is not null
group by user_id, resolved_quadrant;
