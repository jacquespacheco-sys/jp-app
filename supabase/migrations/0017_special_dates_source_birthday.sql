-- ============================================================
-- Migration 0017 — Permitir source='derived_birthday' em special_dates
-- ============================================================
-- O script 05_SQL_initial_classification.sql (Onda 1 do pacote Carnegie)
-- insere special_dates com source='derived_birthday' para aniversários
-- auto-gerados a partir de contacts.birthday. A migration 0014 original
-- só permitia ('manual','derived_first_met','derived_company_start') no
-- check constraint, causando violação ao rodar o script 05.
--
-- Esta migration relaxa o constraint adicionando 'derived_birthday'.
-- Idempotente — pode rodar quantas vezes quiser.
-- ============================================================

alter table special_dates drop constraint if exists special_dates_source_check;

alter table special_dates add constraint special_dates_source_check
  check (source in (
    'manual',
    'derived_first_met',
    'derived_company_start',
    'derived_birthday'
  ));

comment on column special_dates.source is
  'Origem da data: manual (criada pelo user), derived_first_met (Onda 1 a partir de first_met_at), derived_company_start (a partir de company_start_date), derived_birthday (Onda 1 a partir de contacts.birthday).';
