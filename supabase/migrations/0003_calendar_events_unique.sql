-- Add unique constraint required for upsert on conflict
alter table public.calendar_events
  add constraint calendar_events_user_id_google_event_id_key
  unique (user_id, google_event_id);
