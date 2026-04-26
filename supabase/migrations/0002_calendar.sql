-- =============================================================
-- JP APP — Migration 0002: Módulo Calendar
-- Depende de: users, tasks (migration 0001)
-- =============================================================

-- =============================================================
-- CALENDARS
-- =============================================================
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  google_calendar_id text not null,
  summary text not null,
  description text,
  google_color_id text,
  custom_color text,
  is_primary boolean not null default false,
  is_visible boolean not null default true,
  is_default_for_create boolean not null default false,
  access_role text,
  sync_token text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, google_calendar_id)
);
create index on public.calendars(user_id);

-- =============================================================
-- CALENDAR_EVENTS
-- =============================================================
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  google_event_id text,
  ical_uid text,
  summary text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text,
  status text not null default 'confirmed',
  recurrence text[],
  recurring_event_id text,
  attendees jsonb,
  organizer_email text,
  is_organizer boolean not null default true,
  source text not null default 'google',
  task_id uuid references public.tasks(id) on delete set null,
  synced boolean not null default false,
  etag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.calendar_events(user_id);
create index on public.calendar_events(calendar_id);
create index on public.calendar_events(start_at);
create index on public.calendar_events(google_event_id);

-- =============================================================
-- EVENT_LOGS
-- =============================================================
create table public.event_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.calendar_events(id) on delete cascade,
  user_id uuid not null references public.users(id),
  action text not null,
  changes jsonb,
  source text not null,
  timestamp timestamptz not null default now()
);
