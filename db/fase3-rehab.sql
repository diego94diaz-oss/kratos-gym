-- ============================================================
--  KRATOS GYM — Migración Fase 3: rehabilitación (registro de dolor)
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Idempotente.
-- ============================================================
create table if not exists rehab_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  injury_id   uuid references injuries(id) on delete cascade,
  fecha       date not null default current_date,
  dolor       int,        -- 0-10
  carga       text,       -- descanso | suave | moderada | normal
  notas       text,
  created_at  timestamptz default now()
);

alter table rehab_logs enable row level security;
drop policy if exists "own_rehab_logs" on rehab_logs;
create policy "own_rehab_logs" on rehab_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_rehab_user_injury on rehab_logs(user_id, injury_id, fecha);
