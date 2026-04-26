-- Partial unique index: only one google_contact_id per user (nulls allowed for manual contacts)
create unique index contacts_user_google_id_key
  on public.contacts (user_id, google_contact_id)
  where google_contact_id is not null;
