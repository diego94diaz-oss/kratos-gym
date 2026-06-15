-- ============================================================
--  KRATOS GYM — Migración Fase 2: notificaciones push
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Idempotente.
-- ============================================================

-- Preferencias de recordatorios (JSON) en el perfil
alter table profile add column if not exists reminders jsonb;

-- Suscripciones Web Push (una por dispositivo/navegador)
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;
drop policy if exists "own_push_subscriptions" on push_subscriptions;
create policy "own_push_subscriptions" on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_push_user on push_subscriptions(user_id);
