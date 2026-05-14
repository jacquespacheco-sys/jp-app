-- ============================================================
-- Migration 0015 — Rituais pessoais Carnegie
-- ============================================================
-- 3 tabelas para os rituais que você consigo mesmo:
--   - principle_of_month  : foco mensal nos 30 princípios Carnegie
--   - weekly_reflections  : reflexão dominical (3 perguntas)
--   - gratitude_entries   : diário de gratidão (sexta 18h)
-- ============================================================

-- ============================================================
-- 1. principle_of_month
-- ============================================================

create table if not exists principle_of_month (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,

  principle       text not null check (principle ~ '^P([1-9]|[12][0-9]|30)$'),

  month           text not null check (month ~ '^\d{4}-\d{2}$'),

  target_applications int not null default 12,

  reflection      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, month)
);

create index if not exists principle_of_month_user_month_idx
  on principle_of_month(user_id, month);

create or replace function set_pom_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists pom_updated_at_trigger on principle_of_month;
create trigger pom_updated_at_trigger
  before update on principle_of_month
  for each row execute function set_pom_updated_at();

-- ============================================================
-- 2. weekly_reflections
-- ============================================================

create table if not exists weekly_reflections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,

  week            text not null check (week ~ '^\d{4}-W\d{2}$'),

  marked_me_contact_id uuid references contacts(id) on delete set null,
  marked_me_why        text,

  let_down_contact_id  uuid references contacts(id) on delete set null,
  let_down_why         text,

  reconnect_contact_id uuid references contacts(id) on delete set null,
  reconnect_handled    boolean not null default false,

  created_at      timestamptz not null default now(),

  unique (user_id, week)
);

create index if not exists weekly_reflections_user_week_idx
  on weekly_reflections(user_id, week desc);
create index if not exists weekly_reflections_reconnect_pending_idx
  on weekly_reflections(user_id)
  where reconnect_handled = false and reconnect_contact_id is not null;

-- ============================================================
-- 3. gratitude_entries
-- ============================================================

create table if not exists gratitude_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  contact_id      uuid references contacts(id) on delete set null,

  text            text not null check (length(text) <= 280 and length(text) > 0),

  shared          boolean not null default false,
  shared_at       timestamptz,
  shared_channel  text check (shared_channel in ('whatsapp','email','linkedin','sms','phone')),

  created_at      timestamptz not null default now()
);

create index if not exists gratitude_entries_user_created_idx
  on gratitude_entries(user_id, created_at desc);
create index if not exists gratitude_entries_contact_idx
  on gratitude_entries(contact_id) where contact_id is not null;

-- ============================================================
-- 4. View: gratitude top contacts no ano
-- ============================================================

create or replace view v_gratitude_top_contacts as
select
  g.user_id,
  g.contact_id,
  c.first_name,
  c.last_name,
  extract(year from g.created_at)::int as year,
  count(*) as mentions,
  max(g.created_at) as last_mention_at
from gratitude_entries g
join contacts c on c.id = g.contact_id
where g.contact_id is not null
group by g.user_id, g.contact_id, c.first_name, c.last_name, extract(year from g.created_at);

-- ============================================================
-- 5. Comments
-- ============================================================
comment on table principle_of_month is 'Princípio Carnegie em foco no mês. Métricas alimentam review mensal.';
comment on table weekly_reflections is 'Reflexão dominical. 3 perguntas. Q3 (reconnect) vira card no Pulso de segunda.';
comment on table gratitude_entries is 'Diário de gratidão sexta 18h. Pode ou não ser compartilhado com o contato. Vira retrospectiva anual.';
