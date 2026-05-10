create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  title text not null,
  url text not null,
  summary text,
  content text,
  author text,
  image_url text,
  published_at timestamptz not null,
  favorited boolean not null default false,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, url)
);
create index on public.news_items(user_id, published_at desc);
create index on public.news_items(user_id, favorited);
