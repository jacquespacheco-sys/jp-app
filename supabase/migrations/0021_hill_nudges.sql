-- =============================================================
-- JP APP — Migration 0021: Módulo Hill · Daily Nudges (Fase 3)
-- Aditiva. Depende de 0020 (hill_coach_messages, hill_preferences).
-- Nudge é um hill_coach_messages com mode='daily_nudge' + metadados.
-- =============================================================

-- Metadados de nudge em hill_coach_messages
alter table public.hill_coach_messages
  add column if not exists nudge_category  text,
  add column if not exists nudge_trigger   text,
  add column if not exists user_dismissed  boolean not null default false,
  add column if not exists user_feedback   smallint;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'hill_coach_messages_feedback_chk') then
    alter table public.hill_coach_messages
      add constraint hill_coach_messages_feedback_chk
      check (user_feedback is null or user_feedback in (-1, 0, 1));
  end if;
end $$;

create index if not exists hill_coach_messages_nudges_idx
  on public.hill_coach_messages(user_id, nudge_category, created_at desc)
  where mode = 'daily_nudge';

-- Off-switch por categoria + hora do nudge
alter table public.hill_preferences
  add column if not exists disabled_categories text[] not null default '{}',
  add column if not exists nudge_hour          smallint not null default 8;

-- Log de feedback (alimenta o aprendizado: 3 negativos seguidos pausam categoria 30d)
create table if not exists public.hill_nudge_feedback (
  id                uuid primary key default gen_random_uuid(),
  coach_message_id  uuid not null references public.hill_coach_messages(id) on delete cascade,
  user_id           uuid not null references public.users(id) on delete cascade,
  rating            smallint not null check (rating in (-1, 0, 1)),
  reason            text,
  created_at        timestamptz not null default now()
);

create index if not exists hill_nudge_feedback_user_idx
  on public.hill_nudge_feedback(user_id, created_at desc);
create index if not exists hill_nudge_feedback_msg_idx
  on public.hill_nudge_feedback(coach_message_id);

comment on table public.hill_nudge_feedback is 'Feedback do usuário por nudge (-1/0/+1). 3 negativos seguidos numa categoria pausam-na por 30 dias.';
