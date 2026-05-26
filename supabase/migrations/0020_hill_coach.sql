-- =============================================================
-- JP APP — Migration 0020: Módulo Hill · Coach IA (Fase 2)
-- Aditiva. Depende de 0001 (users) e 0010 (set_updated_at).
-- Coach Hill é um sistema próprio (persona Napoleon Hill, 4 modos),
-- separado do coach geral do app (coach_log/coach_memory).
-- Sem RLS (padrão JP App: JWT próprio + service key).
-- =============================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'hill_coach_mode') then
    create type public.hill_coach_mode as enum ('chat','ritual_murmur','wizard_step','daily_nudge');
  end if;
  if not exists (select 1 from pg_type where typname = 'hill_message_role') then
    create type public.hill_message_role as enum ('user','coach');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- -------------------------------------------------------------
-- hill_coach_messages
-- conversation_id agrupa turns de chat; murmur/nudge têm conv_id próprio efêmero.
-- context_used: snapshot do user_context enviado (debug + anti-repetição de nudges).
-- -------------------------------------------------------------
create table if not exists public.hill_coach_messages (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  conversation_id   uuid not null,
  mode              public.hill_coach_mode not null,
  role              public.hill_message_role not null,
  content           text not null,
  context_used      jsonb,
  tokens_in         int,
  tokens_out        int,
  model             text,
  cost              numeric(10,6),
  action_payload    jsonb,
  user_action_taken boolean,
  created_at        timestamptz not null default now()
);

create index if not exists hill_coach_messages_user_idx
  on public.hill_coach_messages(user_id, created_at desc);
create index if not exists hill_coach_messages_conv_idx
  on public.hill_coach_messages(conversation_id, created_at);
create index if not exists hill_coach_messages_mode_idx
  on public.hill_coach_messages(user_id, mode, created_at desc);

-- -------------------------------------------------------------
-- hill_preferences
-- 1 linha por usuário. Voz do coach + toggles (nudge/murmur).
-- -------------------------------------------------------------
create table if not exists public.hill_preferences (
  user_id                uuid primary key references public.users(id) on delete cascade,
  coach_voice            text not null default 'mixed' check (coach_voice in ('strict','mixed','gentle')),
  daily_nudge_enabled    boolean not null default true,
  ritual_murmurs_enabled boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

drop trigger if exists hill_preferences_updated_at on public.hill_preferences;
create trigger hill_preferences_updated_at before update on public.hill_preferences
  for each row execute function public.set_updated_at();

comment on table public.hill_coach_messages is 'Mensagens do Coach Hill (persona Napoleon Hill, 4 modos). Separado de coach_log.';
comment on table public.hill_preferences is 'Preferências do módulo Hill por usuário (voz do coach, toggles).';
