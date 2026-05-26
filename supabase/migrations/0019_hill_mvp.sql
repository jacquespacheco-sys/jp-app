-- =============================================================
-- JP APP — Migration 0019: Módulo Hill · MVP do core (Fase 1)
-- Aditiva. Depende de 0001 (users, tasks, projects) e 0010 (set_updated_at).
-- Tabelas: hill_chief_aims, hill_goals, hill_affirmations, hill_ritual_logs.
-- Sem RLS (app usa JWT próprio + service key, padrão do JP App).
-- =============================================================

-- -------------------------------------------------------------
-- ENUMs (idempotente — prefixados hill_ p/ namespacing do módulo)
-- -------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'hill_goal_level') then
    create type public.hill_goal_level as enum ('dream','goal','quarterly');
  end if;
  if not exists (select 1 from pg_type where typname = 'hill_goal_status') then
    create type public.hill_goal_status as enum ('active','completed','archived','failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'hill_affirmation_dimension') then
    create type public.hill_affirmation_dimension as enum ('identidade','acao','capacidade','relacoes','integracao');
  end if;
  if not exists (select 1 from pg_type where typname = 'hill_affirmation_status') then
    create type public.hill_affirmation_status as enum ('active','retired','superseded');
  end if;
  if not exists (select 1 from pg_type where typname = 'hill_ritual_type') then
    create type public.hill_ritual_type as enum ('morning','night');
  end if;
end $$;

-- -------------------------------------------------------------
-- Trigger genérico updated_at (já existe via 0010; recriado p/ self-contained)
-- -------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- -------------------------------------------------------------
-- 1. hill_chief_aims
-- Objetivo definido com clareza absoluta (Napoleon Hill).
-- Versionado por archive: aim_text é imutável; mudou → cria novo, arquiva antigo.
-- Só 1 ativo por usuário.
-- -------------------------------------------------------------
create table if not exists public.hill_chief_aims (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  aim_text      text not null,
  deadline      date not null,
  exchange_text text not null,
  plan_text     text,
  is_active     boolean not null default true,
  archived_at   timestamptz,
  next_review   date not null default (current_date + 90),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists hill_chief_aims_user_active_idx
  on public.hill_chief_aims(user_id) where is_active;
create index if not exists hill_chief_aims_user_idx
  on public.hill_chief_aims(user_id);
create index if not exists hill_chief_aims_next_review_idx
  on public.hill_chief_aims(next_review) where is_active;

drop trigger if exists hill_chief_aims_updated_at on public.hill_chief_aims;
create trigger hill_chief_aims_updated_at before update on public.hill_chief_aims
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 2. hill_goals
-- Hierarquia Dream → Goal → Quarterly (parent_id self-ref).
-- Fase 1 não usa a hierarquia na UI, mas o schema já a suporta.
-- linked_project_id liga ao Project existente do JP App.
-- -------------------------------------------------------------
create table if not exists public.hill_goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  chief_aim_id      uuid references public.hill_chief_aims(id) on delete set null,
  parent_id         uuid references public.hill_goals(id) on delete set null,
  level             public.hill_goal_level not null,
  title             text not null,
  metric_text       text,
  metric_value      numeric,
  metric_unit       text,
  progress_pct      numeric not null default 0 check (progress_pct between 0 and 100),
  deadline          date,
  status            public.hill_goal_status not null default 'active',
  linked_project_id uuid references public.projects(id) on delete set null,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists hill_goals_user_active_idx
  on public.hill_goals(user_id, status) where status = 'active';
create index if not exists hill_goals_parent_idx on public.hill_goals(parent_id);
create index if not exists hill_goals_chief_aim_idx on public.hill_goals(chief_aim_id);
create index if not exists hill_goals_project_idx on public.hill_goals(linked_project_id)
  where linked_project_id is not null;

drop trigger if exists hill_goals_updated_at on public.hill_goals;
create trigger hill_goals_updated_at before update on public.hill_goals
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 3. hill_affirmations
-- 5 afirmações ativas (1 por dimensão), versionadas por superseded_by.
-- Edição avulsa trava (D3): mudança legítima só via revisão trimestral.
-- derived_from: jsonb p/ afirmações de Capacidade extraídas de evidências (goals.id).
-- -------------------------------------------------------------
create table if not exists public.hill_affirmations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  chief_aim_id   uuid not null references public.hill_chief_aims(id) on delete cascade,
  dimension      public.hill_affirmation_dimension not null,
  text           text not null,
  belief_score   smallint not null check (belief_score between 1 and 5),
  derived_from   jsonb,
  status         public.hill_affirmation_status not null default 'active',
  superseded_by  uuid references public.hill_affirmations(id) on delete set null,
  retired_reason text,
  active_from    date not null default current_date,
  active_until   date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists hill_affirmations_user_dim_active_idx
  on public.hill_affirmations(user_id, dimension) where status = 'active';
create index if not exists hill_affirmations_user_idx on public.hill_affirmations(user_id);
create index if not exists hill_affirmations_chief_aim_idx on public.hill_affirmations(chief_aim_id);

drop trigger if exists hill_affirmations_updated_at on public.hill_affirmations;
create trigger hill_affirmations_updated_at before update on public.hill_affirmations
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 4. hill_ritual_logs
-- Logs detalhados do ritual matinal (4 passos) e noturno (5 passos).
-- daily_action_task_id faz a ponte com o sistema de Tasks (passo 3 da manhã).
-- Sem updated_at: log é criado (start) e completado (patch) via colunas próprias.
-- -------------------------------------------------------------
create table if not exists public.hill_ritual_logs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  type                 public.hill_ritual_type not null,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  duration_seconds     int,
  steps_completed      jsonb not null default '[]'::jsonb,
  affirmations_read    uuid[] not null default '{}',
  affirmations_skipped uuid[] not null default '{}',
  reflection_data      jsonb,
  gratitude_items      text[],
  daily_action_task_id uuid references public.tasks(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists hill_ritual_logs_user_type_idx
  on public.hill_ritual_logs(user_id, type);
create index if not exists hill_ritual_logs_completed_idx
  on public.hill_ritual_logs(user_id, completed_at) where completed_at is not null;
create index if not exists hill_ritual_logs_started_idx
  on public.hill_ritual_logs(started_at desc);

-- -------------------------------------------------------------
-- Comments
-- -------------------------------------------------------------
comment on table public.hill_chief_aims is 'Chief Aim (Napoleon Hill). 1 ativo/usuário; versionado por archive (aim_text imutável).';
comment on table public.hill_goals is 'Hierarquia Dream/Goal/Quarterly. Liga opcionalmente a projects via linked_project_id.';
comment on table public.hill_affirmations is '5 afirmações ativas (1/dimensão). Versionadas por superseded_by; mudança legítima só na revisão trimestral.';
comment on table public.hill_ritual_logs is 'Logs do ritual matinal/noturno. daily_action_task_id faz ponte com Tasks.';
