-- Note folders (hierarchical)
create table public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.note_folders(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.note_folders(user_id);

-- Note tags
create table public.note_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text not null default '#a8ff00',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index on public.note_tags(user_id);

-- Notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  folder_id uuid references public.note_folders(id) on delete set null,
  type text not null check (type in ('postit', 'text', 'audio', 'link')),
  title text,
  content text not null default '',
  url text,
  thumbnail_url text,
  audio_duration integer,
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.notes(user_id, created_at desc);
create index on public.notes(folder_id);

-- Note ↔ Tag junction
create table public.note_tag_map (
  note_id uuid not null references public.notes(id) on delete cascade,
  tag_id uuid not null references public.note_tags(id) on delete cascade,
  primary key (note_id, tag_id)
);
