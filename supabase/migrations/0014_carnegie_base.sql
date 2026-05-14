-- ============================================================
-- Migration 0014 — Carnegie base
-- ============================================================
-- Estende contacts e interactions com a camada de relacionamento
-- (tier, cadência, hooks, family, etc).
-- Adiciona 3 tabelas: special_dates, referrals, compliments_received.
-- Todas as colunas novas são opcionais e seguras (default null ou
-- default seguro). Nada quebra do que existia.
-- ============================================================

-- ============================================================
-- 1. Extensões em contacts
-- ============================================================

alter table contacts
  add column if not exists tier text check (tier in ('inner','strong','network','weak','dormant')),
  add column if not exists cadence_days int,

  add column if not exists last_interaction_at timestamptz,

  add column if not exists preferred_name text,
  add column if not exists pronunciation text,

  add column if not exists interests text[] default '{}',
  add column if not exists conversation_hooks text[] default '{}',
  add column if not exists what_they_value text,
  add column if not exists their_goals text,
  add column if not exists family jsonb,

  add column if not exists first_met_at timestamptz,
  add column if not exists company_start_date date,

  add column if not exists preferred_channel text check (preferred_channel in ('whatsapp','email','linkedin','sms','phone')),
  add column if not exists favor_balance int default 0,

  add column if not exists linkedin_url text,
  add column if not exists twitter_handle text,
  add column if not exists instagram_handle text,

  add column if not exists last_signal jsonb,
  add column if not exists last_signal_at timestamptz,

  add column if not exists source_contact_id uuid references contacts(id) on delete set null,
  add column if not exists source_context text;

create index if not exists contacts_tier_idx on contacts(user_id, tier) where archived = false;
create index if not exists contacts_last_interaction_idx on contacts(user_id, last_interaction_at desc) where archived = false;
create index if not exists contacts_source_idx on contacts(source_contact_id) where source_contact_id is not null;

-- ============================================================
-- 2. Extensões em interactions
-- ============================================================

alter table interactions
  add column if not exists initiator text check (initiator in ('me','them')),
  add column if not exists sentiment text check (sentiment in ('positive','neutral','tense')),
  add column if not exists topics_discussed text[] default '{}',
  add column if not exists carnegie_tags text[] default '{}',
  add column if not exists interaction_tags text[] default '{}',
  add column if not exists compliment_text text,
  add column if not exists referral_from_id uuid references contacts(id) on delete set null,
  add column if not exists new_learning text,
  add column if not exists promise_made text;

create index if not exists interactions_contact_date_idx on interactions(contact_id, date desc);
create index if not exists interactions_referral_from_idx on interactions(referral_from_id) where referral_from_id is not null;

-- ============================================================
-- 3. Trigger: manter contacts.last_interaction_at em cache
-- ============================================================

create or replace function update_contact_last_interaction()
returns trigger
language plpgsql
as $$
begin
  update contacts
    set last_interaction_at = (
      select max(date) from interactions where contact_id = new.contact_id
    )
    where id = new.contact_id;
  return new;
end;
$$;

drop trigger if exists interactions_update_contact_last_interaction on interactions;
create trigger interactions_update_contact_last_interaction
  after insert or update of date on interactions
  for each row execute function update_contact_last_interaction();

create or replace function update_contact_favor_balance()
returns trigger
language plpgsql
as $$
declare
  delta int := 0;
begin
  if 'gave_intro'         = any(new.interaction_tags) then delta := delta + 1; end if;
  if 'gave_referral'      = any(new.interaction_tags) then delta := delta + 1; end if;
  if 'gave_advice'        = any(new.interaction_tags) then delta := delta + 1; end if;
  if 'gave_gift'          = any(new.interaction_tags) then delta := delta + 1; end if;
  if 'wrote_recommendation' = any(new.interaction_tags) then delta := delta + 1; end if;
  if 'received_intro'     = any(new.interaction_tags) then delta := delta - 1; end if;
  if 'received_referral'  = any(new.interaction_tags) then delta := delta - 1; end if;
  if 'received_advice'    = any(new.interaction_tags) then delta := delta - 1; end if;
  if 'received_gift'      = any(new.interaction_tags) then delta := delta - 1; end if;

  if delta <> 0 then
    update contacts
      set favor_balance = coalesce(favor_balance, 0) + delta
      where id = new.contact_id;
  end if;
  return new;
end;
$$;

drop trigger if exists interactions_update_favor_balance on interactions;
create trigger interactions_update_favor_balance
  after insert on interactions
  for each row
  when (new.interaction_tags is not null and array_length(new.interaction_tags, 1) > 0)
  execute function update_contact_favor_balance();

-- ============================================================
-- 4. Tabela: special_dates
-- ============================================================

create table if not exists special_dates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  label           text not null,
  type            text not null check (type in ('celebrate','acknowledge','silence','check_in')),

  date_anniversary text check (date_anniversary ~ '^\d{2}/\d{2}$'),
  date_full        date,
  recurring       boolean not null default true,

  lead_days       int default 2,

  silence_days    int,

  private_note    text,

  source          text default 'manual' check (source in ('manual','derived_first_met','derived_company_start')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  check (date_anniversary is not null or date_full is not null)
);

create index if not exists special_dates_user_anniversary_idx
  on special_dates(user_id, date_anniversary)
  where date_anniversary is not null;
create index if not exists special_dates_user_full_idx
  on special_dates(user_id, date_full)
  where date_full is not null;
create index if not exists special_dates_contact_idx on special_dates(contact_id);

create or replace function set_special_dates_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists special_dates_updated_at_trigger on special_dates;
create trigger special_dates_updated_at_trigger
  before update on special_dates
  for each row execute function set_special_dates_updated_at();

-- ============================================================
-- 5. Tabela: referrals
-- ============================================================

create table if not exists referrals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,

  from_contact_id   uuid not null references contacts(id) on delete cascade,
  to_contact_id     uuid references contacts(id) on delete set null,

  context           text not null,
  outcome_note      text,

  feedback_given    boolean not null default false,
  feedback_given_at timestamptz,

  status            text not null default 'open' check (status in ('open','closed','dropped')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists referrals_user_status_idx on referrals(user_id, status, created_at desc);
create index if not exists referrals_from_contact_idx on referrals(from_contact_id);
create index if not exists referrals_open_pending_idx on referrals(user_id) where status = 'open' and feedback_given = false;

create or replace function set_referrals_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists referrals_updated_at_trigger on referrals;
create trigger referrals_updated_at_trigger
  before update on referrals
  for each row execute function set_referrals_updated_at();

-- ============================================================
-- 6. Tabela: compliments_received
-- ============================================================

create table if not exists compliments_received (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  contact_id        uuid not null references contacts(id) on delete cascade,

  text              text not null,
  received_at       timestamptz not null default now(),
  context           text,

  remind_to_reciprocate_at timestamptz,

  reciprocated      boolean not null default false,
  reciprocated_at   timestamptz,
  reciprocation_note text,

  created_at        timestamptz not null default now()
);

create index if not exists compliments_contact_idx on compliments_received(contact_id);
create index if not exists compliments_remind_idx on compliments_received(user_id, remind_to_reciprocate_at)
  where reciprocated = false and remind_to_reciprocate_at is not null;

create or replace function set_compliment_remind_at()
returns trigger language plpgsql as $$
begin
  if new.remind_to_reciprocate_at is null then
    new.remind_to_reciprocate_at := new.received_at + (120 + floor(random() * 60))::int * interval '1 day';
  end if;
  return new;
end $$;

drop trigger if exists compliments_set_remind_at_trigger on compliments_received;
create trigger compliments_set_remind_at_trigger
  before insert on compliments_received
  for each row execute function set_compliment_remind_at();

-- ============================================================
-- 7. View útil: contacts overdue por tier
-- ============================================================
-- Cadência alvo por tier (override por contacts.cadence_days):
--   inner=14, strong=30, network=90, weak=180, dormant=365

create or replace view v_contacts_overdue as
select
  c.*,
  case
    when c.cadence_days is not null then c.cadence_days
    when c.tier = 'inner'   then 14
    when c.tier = 'strong'  then 30
    when c.tier = 'network' then 90
    when c.tier = 'weak'    then 180
    when c.tier = 'dormant' then 365
    else null
  end as effective_cadence_days,
  case
    when c.last_interaction_at is null then null
    else extract(day from (now() - c.last_interaction_at))::int
  end as days_since_last,
  case
    when c.last_interaction_at is null then false
    when c.tier is null then false
    else extract(day from (now() - c.last_interaction_at)) >
      case
        when c.cadence_days is not null then c.cadence_days
        when c.tier = 'inner'   then 14
        when c.tier = 'strong'  then 30
        when c.tier = 'network' then 90
        when c.tier = 'weak'    then 180
        when c.tier = 'dormant' then 365
        else 9999
      end
  end as is_overdue
from contacts c
where c.archived = false;

-- ============================================================
-- 8. Comments para autodocumentação
-- ============================================================
comment on column contacts.tier is 'Carnegie tier: inner(14d)/strong(30d)/network(90d)/weak(180d)/dormant(365d). NULL=não classificado.';
comment on column contacts.cadence_days is 'Override manual da cadência. NULL usa default do tier.';
comment on column contacts.what_they_value is 'Como essa pessoa se sente importante (Carnegie P9).';
comment on column contacts.their_goals is 'O que essa pessoa quer (Carnegie P3, eager want).';
comment on column contacts.conversation_hooks is 'Tópicos que destravam conversa com essa pessoa (Carnegie P8).';
comment on column contacts.favor_balance is 'Saldo de generosidade. Positivo=eu dei mais; negativo=eu recebi mais.';

comment on table special_dates is 'Datas especiais expandidas além do birthday. Tipos: celebrate, acknowledge, silence, check_in.';
comment on table referrals is 'Loop de indicação. Após 30d, app pergunta se já foi dado feedback à pessoa que indicou.';
comment on table compliments_received is 'Elogios recebidos. Sistema sugere retribuição entre 120-180 dias depois (não imediato — não parece troca).';

-- ============================================================
-- 9. Backfill: popular last_interaction_at para contatos existentes
-- ============================================================
-- Sem isto, contatos pré-migration ficam com last_interaction_at NULL até
-- a próxima interaction; Pulso/overdue não renderiza nada nesse intervalo.

update contacts
  set last_interaction_at = sub.max_date
  from (
    select contact_id, max(date) as max_date
    from interactions
    group by contact_id
  ) sub
where contacts.id = sub.contact_id
  and contacts.last_interaction_at is null;
