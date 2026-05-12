-- =============================================================
-- JP APP — Migration 0013: Coach chat MVP
-- Aditiva. Compatível com 0010 (coach_profile, coach_memory, coach_log).
-- =============================================================

-- 1) coach_memory_candidate (staging para extrações pendentes)
create table if not exists public.coach_memory_candidate (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_log_id uuid references public.coach_log(id) on delete set null,
  kind public.memory_kind not null,
  content text not null,
  relevance smallint not null default 50 check (relevance between 0 and 100),
  expires_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists coach_mem_cand_pending_idx
  on public.coach_memory_candidate (user_id, status, created_at desc);

-- 2) users.coach_last_read_at — pro badge de não-lidas
alter table public.users
  add column if not exists coach_last_read_at timestamptz;

-- 3) briefings.coach_paragraph — parágrafo do coach no topo do briefing
alter table public.briefings
  add column if not exists coach_paragraph text;

-- 4) coach_log: conversation_id opcional + index pra recentes por kind
alter table public.coach_log
  add column if not exists conversation_id uuid;
create index if not exists coach_log_user_kind_recent_idx
  on public.coach_log (user_id, kind, created_at desc);
