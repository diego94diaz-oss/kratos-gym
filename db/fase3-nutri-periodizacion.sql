-- ============================================================
--  KRATOS GYM — Migración Fase 3: recetas, suplementos y periodización
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Idempotente.
-- ============================================================

-- Recetas (cabecera) — macros totales precalculados al guardar
create table if not exists recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  porciones   numeric default 1,
  kcal        numeric, prot numeric, grasa numeric, carbo numeric,  -- por porción
  ingredientes jsonb,   -- [{nombre, gramos, kcal, prot, grasa, carbo}]
  created_at  timestamptz default now()
);

-- Suplementos
create table if not exists supplements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  dosis       text,
  horario     text,
  evidencia   text,     -- alta | media | baja
  activo      boolean default true,
  created_at  timestamptz default now()
);
create table if not exists supplement_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  supplement_id uuid not null references supplements(id) on delete cascade,
  fecha       date not null default current_date,
  created_at  timestamptz default now(),
  unique (user_id, supplement_id, fecha)
);

-- Mesociclos (periodización)
create table if not exists mesocycles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  fase        text,     -- acumulacion | intensificacion | realizacion | deload
  semanas     int default 4,
  fecha_inicio date default current_date,
  activo      boolean default true,
  notas       text,
  created_at  timestamptz default now()
);

-- ============================================================
--  RLS
-- ============================================================
alter table recipes         enable row level security;
alter table supplements     enable row level security;
alter table supplement_logs enable row level security;
alter table mesocycles      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recipes','supplements','supplement_logs','mesocycles']
  loop
    execute format('drop policy if exists "own_%1$s" on %1$s', t);
    execute format(
      'create policy "own_%1$s" on %1$s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

create index if not exists idx_recipes_user      on recipes(user_id);
create index if not exists idx_supps_user          on supplements(user_id);
create index if not exists idx_supplogs_user_fecha on supplement_logs(user_id, fecha);
create index if not exists idx_meso_user           on mesocycles(user_id, activo);
