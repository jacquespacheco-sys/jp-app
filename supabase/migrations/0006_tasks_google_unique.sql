-- Unique constraints for Google Tasks sync (needed for upsert onConflict)
-- PostgreSQL unique constraints treat NULLs as distinct, so manual
-- projects/tasks (no google ID) are unaffected.

alter table public.projects
  add constraint projects_user_google_tasklist_key
  unique (user_id, google_task_list_id);

alter table public.tasks
  add constraint tasks_user_google_task_key
  unique (user_id, google_tasks_id);
