-- Replace partial unique index with a proper unique constraint
-- so Supabase upsert onConflict can use it as an arbiter.
-- PostgreSQL unique constraints treat NULLs as distinct, so manual
-- contacts (google_contact_id IS NULL) are unaffected.

drop index if exists public.contacts_user_google_id_key;

alter table public.contacts
  add constraint contacts_user_google_id_key
  unique (user_id, google_contact_id);
