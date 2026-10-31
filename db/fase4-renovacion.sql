-- ============================================================
--  ENTRENAMIENTO — Migración Fase 4: renovación integral
--  Solo agrega columnas y una tabla: no modifica ni borra datos.
--  La app funciona sin ella; sin esto no guarda micronutrientes
--  ni las notas, duración y esfuerzo de cada sesión.
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Idempotente. Rollback: drop table workout_sessions y
--  drop column de las cinco columnas de food_logs.
-- ============================================================

-- Calidad de la dieta por registro
alter table food_logs add column if not exists fibra  numeric;  -- g
alter table food_logs add column if not exists azucar numeric;  -- g (azúcares totales de etiqueta)
alter table food_logs add column if not exists sat    numeric;  -- g de grasa saturada
alter table food_logs add column if not exists sodio  numeric;  -- mg
alter table food_logs add column if not exists nova   int;      -- 1-4 (4 = ultraprocesado)

-- Datos de la sesión (las series siguen en workout_sets)
create table if not exists workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fecha        date not null,
  rutina       text not null,
  nombre       text,
  duracion_min int,
  rpe          numeric,
  notas        text,
  created_at   timestamptz default now(),
  unique (user_id, fecha, rutina)
);
alter table workout_sessions enable row level security;
drop policy if exists "own_workout_sessions" on workout_sessions;
create policy "own_workout_sessions" on workout_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
