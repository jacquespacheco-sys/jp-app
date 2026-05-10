-- =============================================================
-- JP APP — Migration 0011: função de seed das áreas iniciais
-- Idempotente. Chamada pelo backend no onboarding (após criar user).
-- Cria 12 áreas (com hierarquia Casa > Plantas/Manutenção,
-- e Família > Relacionamento) usando ON CONFLICT no slug.
-- =============================================================

create or replace function public.seed_default_areas(p_user_id uuid)
returns void
language plpgsql
as $$
declare
  v_casa_id uuid;
  v_familia_id uuid;
begin
  -- Top-level
  insert into public.areas (user_id, name, slug, quadrant, position, icon)
  values
    (p_user_id, 'STATE Innovation Center', 'state',           'ITS',  10, 'building-2'),
    (p_user_id, 'Finanças',                'financas',        'ITS',  20, 'wallet'),
    (p_user_id, 'Casa',                    'casa',            'ITS',  30, 'home'),
    (p_user_id, 'Família',                 'familia',         'WE',   40, 'users'),
    (p_user_id, 'Amigos & rede',           'amigos',          'WE',   50, 'user-plus'),
    (p_user_id, 'Corpo',                   'corpo',           'IT',   60, 'dumbbell'),
    (p_user_id, 'Mente',                   'mente',           'I',    70, 'brain'),
    (p_user_id, 'Espiritualidade',         'espiritualidade', 'I',    80, 'sparkles'),
    (p_user_id, 'Aprendizado',             'aprendizado',     'I',    90, 'book-open')
  on conflict (user_id, slug) do nothing;

  select id into v_casa_id    from public.areas where user_id = p_user_id and slug = 'casa';
  select id into v_familia_id from public.areas where user_id = p_user_id and slug = 'familia';

  -- Sub-áreas
  insert into public.areas (user_id, parent_id, name, slug, quadrant, position, icon)
  values
    (p_user_id, v_casa_id,    'Plantas',        'plantas',        'ITS', 31, 'leaf'),
    (p_user_id, v_casa_id,    'Manutenção',     'manutencao',     'ITS', 32, 'wrench'),
    (p_user_id, v_familia_id, 'Relacionamento', 'relacionamento', 'WE',  41, 'heart')
  on conflict (user_id, slug) do nothing;
end $$;
