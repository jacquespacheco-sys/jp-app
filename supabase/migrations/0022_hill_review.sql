-- =============================================================
-- JP APP — Migration 0022: Módulo Hill · Revisão Trimestral (Fase 4)
-- Aditiva. Depende de 0019 (hill_chief_aims).
-- Único ponto legítimo de mudança de afirmações (D3 do spec).
-- Mastermind (counselors/sessions) adiado — fora deste escopo.
-- =============================================================

create table if not exists public.hill_quarterly_reviews (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  chief_aim_id          uuid not null references public.hill_chief_aims(id) on delete cascade,
  triggered_at          timestamptz not null default now(),
  completed_at          timestamptz,
  aim_decision          text check (aim_decision is null or aim_decision in ('kept','adjusted','rewritten')),
  affirmation_decisions jsonb,                 -- [{ aff_id, decision, new_aff_id?, reason? }]
  ritual_stats          jsonb,                 -- snapshot no início da revisão
  next_review_date      date not null,
  exported_pdf_url      text,
  created_at            timestamptz not null default now()
);

create index if not exists hill_quarterly_reviews_user_idx
  on public.hill_quarterly_reviews(user_id, triggered_at desc);
-- só uma revisão em aberto por usuário
create unique index if not exists hill_quarterly_reviews_open_idx
  on public.hill_quarterly_reviews(user_id) where completed_at is null;

comment on table public.hill_quarterly_reviews is 'Revisão trimestral guiada. Único ponto legítimo de mudança de afirmações (D3).';
