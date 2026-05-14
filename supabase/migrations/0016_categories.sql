-- ============================================================
-- Migration 0016 — Categorias multidimensionais para contatos
-- ============================================================
-- Sistema flexível de classificação:
--   - category_dimensions: dimensões (Perfil, Assunto, Aproximação, etc) - você cria
--   - categories: opções dentro de cada dimensão (Investidor, Impacto, Amigo)
--   - contact_categories: many-to-many entre contatos e categorias
--
-- Cada contato pode ter múltiplas categorias por dimensão.
-- Categorias podem ter cor (paleta limitada de 10 cores).
-- Seed inicial cria 3 dimensões e 12 categorias.
-- ============================================================

create table if not exists category_dimensions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  label           text not null,
  slug            text not null,
  description     text,
  sort_order      int not null default 0,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists category_dimensions_user_idx
  on category_dimensions(user_id, sort_order)
  where archived = false;

create table if not exists categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  dimension_id    uuid not null references category_dimensions(id) on delete cascade,
  label           text not null,
  slug            text not null,
  color           text check (color in (
    'gray','red','orange','yellow','green','teal','blue','purple','pink','accent'
  )),
  description     text,
  sort_order      int not null default 0,
  archived        boolean not null default false,
  usage_count     int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, dimension_id, slug)
);

create index if not exists categories_dimension_idx
  on categories(dimension_id, sort_order)
  where archived = false;
create index if not exists categories_user_idx
  on categories(user_id)
  where archived = false;

create table if not exists contact_categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  category_id     uuid not null references categories(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (contact_id, category_id)
);

create index if not exists contact_categories_contact_idx
  on contact_categories(contact_id);
create index if not exists contact_categories_category_idx
  on contact_categories(category_id);
create index if not exists contact_categories_user_idx
  on contact_categories(user_id);

create or replace function set_category_dimensions_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists category_dimensions_updated_at_trigger on category_dimensions;
create trigger category_dimensions_updated_at_trigger
  before update on category_dimensions
  for each row execute function set_category_dimensions_updated_at();

create or replace function set_categories_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists categories_updated_at_trigger on categories;
create trigger categories_updated_at_trigger
  before update on categories
  for each row execute function set_categories_updated_at();

create or replace function update_category_usage_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update categories set usage_count = usage_count + 1 where id = new.category_id;
  elsif (tg_op = 'DELETE') then
    update categories set usage_count = greatest(0, usage_count - 1) where id = old.category_id;
  end if;
  return null;
end $$;

drop trigger if exists contact_categories_usage_count_trigger on contact_categories;
create trigger contact_categories_usage_count_trigger
  after insert or delete on contact_categories
  for each row execute function update_category_usage_count();

create or replace view v_contacts_with_categories as
select
  c.*,
  coalesce(
    jsonb_agg(
      distinct jsonb_build_object(
        'id', cat.id,
        'label', cat.label,
        'slug', cat.slug,
        'color', cat.color,
        'dimensionId', cat.dimension_id,
        'dimensionLabel', dim.label,
        'dimensionSlug', dim.slug
      )
    ) filter (where cat.id is not null),
    '[]'::jsonb
  ) as categories
from contacts c
left join contact_categories cc on cc.contact_id = c.id
left join categories cat on cat.id = cc.category_id and cat.archived = false
left join category_dimensions dim on dim.id = cat.dimension_id and dim.archived = false
where c.archived = false
group by c.id;

create or replace function seed_carnegie_categories(p_user_id uuid)
returns void
language plpgsql as $$
declare
  v_dim_perfil      uuid;
  v_dim_assunto     uuid;
  v_dim_aproximacao uuid;
begin
  insert into category_dimensions (user_id, label, slug, description, sort_order)
  values (p_user_id, 'Perfil', 'perfil', 'Como a pessoa se posiciona profissionalmente', 1)
  on conflict (user_id, slug) do update set label = excluded.label
  returning id into v_dim_perfil;

  insert into categories (user_id, dimension_id, label, slug, color, sort_order)
  values
    (p_user_id, v_dim_perfil, 'Cliente',    'cliente',     'blue',   1),
    (p_user_id, v_dim_perfil, 'Investidor', 'investidor',  'green',  2),
    (p_user_id, v_dim_perfil, 'Fornecedor', 'fornecedor',  'orange', 3),
    (p_user_id, v_dim_perfil, 'Parceiro',   'parceiro',    'purple', 4)
  on conflict (user_id, dimension_id, slug) do nothing;

  insert into category_dimensions (user_id, label, slug, description, sort_order)
  values (p_user_id, 'Assunto', 'assunto', 'Temas e áreas de afinidade', 2)
  on conflict (user_id, slug) do update set label = excluded.label
  returning id into v_dim_assunto;

  insert into categories (user_id, dimension_id, label, slug, color, sort_order)
  values
    (p_user_id, v_dim_assunto, 'Impacto',    'impacto',     'green', 1),
    (p_user_id, v_dim_assunto, 'Tecnologia', 'tecnologia',  'blue',  2),
    (p_user_id, v_dim_assunto, 'Eventos',    'eventos',     'accent',3),
    (p_user_id, v_dim_assunto, 'Cultura',    'cultura',     'pink',  4)
  on conflict (user_id, dimension_id, slug) do nothing;

  insert into category_dimensions (user_id, label, slug, description, sort_order)
  values (p_user_id, 'Aproximação', 'aproximacao', 'Natureza do vínculo pessoal', 3)
  on conflict (user_id, slug) do update set label = excluded.label
  returning id into v_dim_aproximacao;

  insert into categories (user_id, dimension_id, label, slug, color, sort_order)
  values
    (p_user_id, v_dim_aproximacao, 'Amigo',   'amigo',    'accent', 1),
    (p_user_id, v_dim_aproximacao, 'Família', 'familia',  'red',    2),
    (p_user_id, v_dim_aproximacao, 'Colega',  'colega',   'gray',   3),
    (p_user_id, v_dim_aproximacao, 'Mentor',  'mentor',   'purple', 4)
  on conflict (user_id, dimension_id, slug) do nothing;
end $$;

do $$
declare v_user record;
begin
  for v_user in select id from users loop
    perform seed_carnegie_categories(v_user.id);
  end loop;
end $$;

comment on table category_dimensions is 'Dimensões de classificação criadas pelo usuário (Perfil, Assunto, Aproximação, etc).';
comment on table categories is 'Opções dentro de cada dimensão (Investidor, Impacto, Amigo). Cor da paleta limitada.';
comment on table contact_categories is 'Junção many-to-many. Cada contato pode ter múltiplas categorias por dimensão.';
comment on column categories.color is 'Cor do chip. Paleta: gray, red, orange, yellow, green, teal, blue, purple, pink, accent.';
comment on column categories.usage_count is 'Contador de uso mantido por trigger. Útil pra ordenar por relevância.';
comment on function seed_carnegie_categories is 'Cria 3 dimensões + 12 categorias iniciais para o user. Idempotente.';
