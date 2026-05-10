-- Sync function that preserves user edits on conflict.
-- On insert (new contact): all Google fields are set.
-- On conflict: identity fields (name, email, phone, birthday) always updated;
--   company/role only set from Google when currently NULL (preserves local edits).
--   notes, phase, next_contact, tags, address are never touched.

create or replace function sync_contacts_from_google(
  p_user_id uuid,
  p_contacts jsonb
)
returns int
language plpgsql
as $$
declare
  cnt int;
begin
  insert into public.contacts (
    user_id, first_name, last_name, email, phone, birthday,
    company, role, google_contact_id, synced, updated_at
  )
  select
    p_user_id,
    (c->>'first_name'),
    (c->>'last_name'),
    (c->>'email'),
    (c->>'phone'),
    (c->>'birthday'),
    (c->>'company'),
    (c->>'role'),
    (c->>'google_contact_id'),
    true,
    now()
  from jsonb_array_elements(p_contacts) as c
  on conflict (user_id, google_contact_id) do update set
    first_name   = excluded.first_name,
    last_name    = excluded.last_name,
    email        = excluded.email,
    phone        = excluded.phone,
    birthday     = excluded.birthday,
    company      = coalesce(contacts.company,  excluded.company),
    role         = coalesce(contacts.role,     excluded.role),
    synced       = true,
    updated_at   = now();

  get diagnostics cnt = row_count;
  return cnt;
end;
$$;
