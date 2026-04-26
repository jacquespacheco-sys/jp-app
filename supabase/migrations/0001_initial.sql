-- =============================================================
-- JP APP — Migration 0001: Schema inicial
-- Ordem: users → projects → contacts → tasks → logs → briefing
-- =============================================================

-- =============================================================
-- USERS
-- =============================================================
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text not null,
  city text,
  timezone text not null default 'America/Sao_Paulo',
  google_refresh_token text,
  anthropic_api_key text,
  theme text not null default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================
-- PROJECTS
-- =============================================================
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text not null default '#a8ff00',
  google_task_list_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects(user_id);

-- =============================================================
-- CONTACTS (antes de tasks por causa do contact_id FK)
-- =============================================================
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  company text,
  role text,
  email text,
  phone text,
  address text,
  birthday text,
  tags text[] not null default '{}',
  phase text,
  next_contact text,
  notes text not null default '',
  google_contact_id text,
  synced boolean not null default false,
  archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.contacts(user_id);

-- =============================================================
-- TASKS
-- =============================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  title text not null,
  notes text not null default '',
  status text not null default 'inbox',
  priority text not null default 'med',
  tags text[] not null default '{}',
  due_date timestamptz,
  start_offset int,
  duration int,
  depends_on uuid[] not null default '{}',
  archived boolean not null default false,
  archived_at timestamptz,
  google_tasks_id text,
  synced boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tasks(user_id);
create index on public.tasks(project_id);
create index on public.tasks(status);
create index on public.tasks(due_date);

create table public.task_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  changes jsonb not null,
  timestamp timestamptz not null default now()
);

-- =============================================================
-- INTERACTIONS, RELATIONSHIPS, CONTACT LOGS
-- =============================================================
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  date timestamptz not null,
  type text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  related_id uuid not null references public.contacts(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (contact_id, related_id)
);

create table public.contact_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  changes jsonb not null,
  timestamp timestamptz not null default now()
);

-- =============================================================
-- BRIEFING
-- =============================================================
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  url text not null,
  active boolean not null default true,
  last_fetch timestamptz,
  created_at timestamptz not null default now()
);

create table public.newsletters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  sender_email text not null,
  active boolean not null default true,
  last_fetch timestamptz,
  created_at timestamptz not null default now()
);

create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  highlight text not null,
  content jsonb not null,
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  model text not null default 'claude-haiku-4-5-20251001',
  token_count int,
  cost numeric(10,4),
  created_at timestamptz not null default now()
);
create index on public.briefings(user_id, date);
