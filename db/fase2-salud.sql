-- ============================================================
--  KRATOS GYM — Migración Fase 2: Salud, hábitos, lesiones y objetivos
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Idempotente.
-- ============================================================

-- Sueño (una fila por día)
create table if not exists sleep_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fecha        date not null default current_date,
  horas        numeric,
  calidad      int,      -- 1-5
  observaciones text,
  created_at   timestamptz default now(),
  unique (user_id, fecha)
);

-- Bienestar: ánimo, estrés, energía (una fila por día)
create table if not exists wellness_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fecha        date not null default current_date,
  animo        int,      -- 1-5
  estres       int,      -- 1-5 (5 = mucho estrés)
  energia      int,      -- 1-5
  observaciones text,
  created_at   timestamptz default now(),
  unique (user_id, fecha)
);

-- Hábitos (definición)
create table if not exists habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  icono       text default '✅',
  activo      boolean default true,
  orden       int default 0,
  created_at  timestamptz default now()
);

-- Registro diario de hábitos
create table if not exists habit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  habit_id    uuid not null references habits(id) on delete cascade,
  fecha       date not null default current_date,
  created_at  timestamptz default now(),
  unique (user_id, habit_id, fecha)
);

-- Lesiones
create table if not exists injuries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  zona          text not null,
  tipo          text,
  severidad     int,      -- 1-5
  estado        text default 'activa',  -- activa | recuperada
  fecha_inicio  date default current_date,
  fecha_fin     date,
  notas         text,
  created_at    timestamptz default now()
);

-- Objetivos SMART
create table if not exists goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  titulo        text not null,
  tipo          text,      -- peso | medida | fuerza | libre  (medida/fuerza guardan la clave en 'referencia')
  referencia    text,      -- p.ej. 'cintura' o 'Press banca con barra'
  valor_inicial numeric,
  valor_objetivo numeric,
  unidad        text,
  fecha_objetivo date,
  estado        text default 'activo',  -- activo | logrado | abandonado
  created_at    timestamptz default now()
);

-- ============================================================
--  RLS
-- ============================================================
alter table sleep_logs    enable row level security;
alter table wellness_logs enable row level security;
alter table habits        enable row level security;
alter table habit_logs    enable row level security;
alter table injuries      enable row level security;
alter table goals         enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sleep_logs','wellness_logs','habits','habit_logs','injuries','goals']
  loop
    execute format('drop policy if exists "own_%1$s" on %1$s', t);
    execute format(
      'create policy "own_%1$s" on %1$s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================================
--  Índices
-- ============================================================
create index if not exists idx_sleep_user_fecha    on sleep_logs(user_id, fecha);
create index if not exists idx_wellness_user_fecha  on wellness_logs(user_id, fecha);
create index if not exists idx_habitlogs_user_fecha on habit_logs(user_id, fecha);
create index if not exists idx_habits_user           on habits(user_id, orden);
create index if not exists idx_injuries_user         on injuries(user_id, estado);
create index if not exists idx_goals_user            on goals(user_id, estado);
