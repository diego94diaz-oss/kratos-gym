-- ============================================================
--  KRATOS GYM — Migración Fase 3: cardio / resistencia
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Idempotente.
-- ============================================================
create table if not exists cardio_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fecha        date not null default current_date,
  modalidad    text,        -- caminata | trote | bici | hiit | eliptica | remo | otro
  duracion_min numeric,
  distancia_km numeric,
  fc_media     int,
  fc_max       int,
  rpe          numeric,
  kcal         int,
  notas        text,
  created_at   timestamptz default now()
);

alter table cardio_sessions enable row level security;
drop policy if exists "own_cardio_sessions" on cardio_sessions;
create policy "own_cardio_sessions" on cardio_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_cardio_user_fecha on cardio_sessions(user_id, fecha);
