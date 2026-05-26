-- =============================================================
-- JP APP — Migration 0023: Módulo Hill · Mastermind (Invisible Counselors)
-- Aditiva. Depende de 0001 (users). Fecha o pacote Hill.
-- Sem RLS (padrão JP App).
-- =============================================================

create table if not exists public.hill_mastermind_counselors (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  short_label     text not null,                  -- "SJ", "MA" — avatar
  archetype       text not null,                  -- "Produto · Foco"
  is_real_person  boolean not null default false,
  context_prompt  text,                           -- como esta voz pensa/fala/decide
  is_active       boolean not null default true,
  display_order   smallint not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists hill_mastermind_counselors_user_idx
  on public.hill_mastermind_counselors(user_id, is_active);

create table if not exists public.hill_mastermind_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  question            text not null,
  counselor_responses jsonb not null,             -- [{ counselor_id, name, response }]
  user_decision       text,
  decision_reason     text,
  held_at             timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index if not exists hill_mastermind_sessions_user_idx
  on public.hill_mastermind_sessions(user_id, held_at desc);

comment on table public.hill_mastermind_counselors is 'Invisible Counselors (Hill): vozes que o usuário convoca para decisões.';
comment on table public.hill_mastermind_sessions is 'Reuniões do mastermind: pergunta → respostas das vozes → decisão do usuário.';
