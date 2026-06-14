-- ============================================================
--  KRATOS GYM — Esquema de base de datos (Supabase / Postgres)
--  Compatible con el modelo de datos del coach Kratos.
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
-- ============================================================

-- Perfil (una fila por usuario)
create table if not exists profile (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  nombre       text,
  edad         int,
  estatura_cm  numeric,
  objetivo     text default 'recomposicion', -- ganar | perder | mantener | recomposicion | fuerza
  experiencia  text default 'principiante',
  peso_objetivo_kg numeric,                  -- opcional, meta de peso corporal
  kcal_objetivo    int,
  proteina_g       int,
  notas        text,
  updated_at   timestamptz default now()
);

-- Catálogo de ejercicios (rutina A/B precargada y editable)
create table if not exists exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  dia         text,            -- 'A' | 'B' | null (libre)
  grupo       text,            -- piernas, pecho, espalda, hombro, brazo, core...
  orden       int default 0,
  series_obj  int default 3,
  reps_min    int default 8,
  reps_max    int default 12,
  rir_obj     numeric default 2,
  incremento_kg numeric default 2.5,
  unidad      text default 'barra', -- barra | mancuerna | peso_corporal | tiempo
  activo      boolean default true,
  notas       text,
  created_at  timestamptz default now()
);

-- Sets registrados (mapea 1:1 con entrenamientos.csv de Kratos)
-- fecha,rutina,ejercicio,serie,reps,peso_kg,rir,observaciones
create table if not exists workout_sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fecha        date not null default current_date,
  rutina       text,            -- 'A' | 'B'
  ejercicio    text not null,
  exercise_id  uuid references exercises(id) on delete set null,
  serie        int not null,
  reps         int not null,
  peso_kg      numeric not null default 0,
  rir          numeric,
  observaciones text,
  created_at   timestamptz default now()
);

-- Peso corporal (mapea con peso_corporal.csv)
create table if not exists body_weight (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fecha        date not null default current_date,
  peso_kg      numeric not null,
  observaciones text,
  created_at   timestamptz default now(),
  unique (user_id, fecha)
);

-- Medidas corporales (mapea con medidas.csv)
create table if not exists measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  fecha       date not null default current_date,
  medida      text not null,  -- cintura, pecho, brazo, muslo...
  valor_cm    numeric not null,
  created_at  timestamptz default now()
);

-- ============================================================
--  Seguridad: Row Level Security (cada usuario ve solo lo suyo)
-- ============================================================
alter table profile        enable row level security;
alter table exercises      enable row level security;
alter table workout_sets   enable row level security;
alter table body_weight    enable row level security;
alter table measurements   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profile','exercises','workout_sets','body_weight','measurements']
  loop
    execute format('drop policy if exists "own_%1$s" on %1$s', t);
    execute format(
      'create policy "own_%1$s" on %1$s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================================
--  Índices
-- ============================================================
create index if not exists idx_sets_user_fecha   on workout_sets(user_id, fecha);
create index if not exists idx_sets_user_ejerc    on workout_sets(user_id, ejercicio);
create index if not exists idx_weight_user_fecha  on body_weight(user_id, fecha);
create index if not exists idx_exercises_user      on exercises(user_id, dia, orden);
