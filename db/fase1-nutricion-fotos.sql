-- ============================================================
--  KRATOS GYM — Migración Fase 1: Nutrición + Fotos de progreso
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Es idempotente (puedes correrlo más de una vez sin romper nada).
-- ============================================================

-- ---- Perfil: columnas extra para BMR/TDEE ----
alter table profile add column if not exists sexo       text default 'h';      -- 'h' | 'm'
alter table profile add column if not exists actividad  numeric default 1.45;  -- factor de actividad
alter table profile add column if not exists grasa_pct  numeric;               -- %graso conocido (opcional)
alter table profile add column if not exists grasa_g    int;                   -- objetivo grasa (g)
alter table profile add column if not exists carbo_g    int;                   -- objetivo carbos (g)

-- ---- Objetivos nutricionales (versionados por fecha) ----
create table if not exists nutrition_targets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  fecha       date not null default current_date,
  kcal        int,
  proteina_g  int,
  grasa_g     int,
  carbo_g     int,
  metodo      text default 'auto',  -- 'auto' | 'manual'
  created_at  timestamptz default now()
);

-- ---- Catálogo de alimentos (cache de Open Food Facts + manuales) ----
create table if not exists foods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  marca       text,
  barcode     text,
  kcal_100    numeric,   -- valores por 100 g/ml
  prot_100    numeric,
  grasa_100   numeric,
  carbo_100   numeric,
  fibra_100   numeric,
  porcion_g   numeric,   -- porción sugerida
  fuente      text default 'manual',  -- 'off' | 'manual'
  favorito    boolean default false,
  created_at  timestamptz default now()
);

-- ---- Registro alimentario (cada porción consumida) ----
create table if not exists food_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  fecha       date not null default current_date,
  comida      text,      -- desayuno | almuerzo | cena | snack
  food_id     uuid references foods(id) on delete set null,
  nombre      text,      -- snapshot del nombre del alimento
  gramos      numeric not null default 100,
  kcal        numeric,
  prot        numeric,
  grasa       numeric,
  carbo       numeric,
  created_at  timestamptz default now()
);

-- ---- Fotos de progreso (metadatos; el archivo va a Storage) ----
create table if not exists progress_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  fecha       date not null default current_date,
  pose        text,      -- frente | lado | espalda
  path        text not null,
  created_at  timestamptz default now()
);

-- ============================================================
--  RLS — cada usuario solo ve lo suyo
-- ============================================================
alter table nutrition_targets enable row level security;
alter table foods             enable row level security;
alter table food_logs         enable row level security;
alter table progress_photos   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['nutrition_targets','foods','food_logs','progress_photos']
  loop
    execute format('drop policy if exists "own_%1$s" on %1$s', t);
    execute format(
      'create policy "own_%1$s" on %1$s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================================
--  Índices
-- ============================================================
create index if not exists idx_foodlogs_user_fecha on food_logs(user_id, fecha);
create index if not exists idx_foods_user           on foods(user_id);
create index if not exists idx_ntargets_user_fecha  on nutrition_targets(user_id, fecha);
create index if not exists idx_photos_user_fecha     on progress_photos(user_id, fecha);

-- ============================================================
--  Storage: bucket PRIVADO para fotos de progreso
--  Convención de ruta: <user_id>/<archivo>  (la primera carpeta = uid)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

-- Políticas sobre storage.objects: solo el dueño (carpeta raíz = su uid)
drop policy if exists "photos_select_own" on storage.objects;
drop policy if exists "photos_insert_own" on storage.objects;
drop policy if exists "photos_delete_own" on storage.objects;

create policy "photos_select_own" on storage.objects for select
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_insert_own" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_delete_own" on storage.objects for delete
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
