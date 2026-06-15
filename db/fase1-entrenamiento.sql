-- ============================================================
--  KRATOS GYM — Migración Fase 1: registro de entrenamiento enriquecido
--  Ejecuta TODO este archivo en: Supabase > SQL Editor > New query
--  Idempotente. Añade RPE, tipo de serie, descanso y tempo a workout_sets.
-- ============================================================

alter table workout_sets add column if not exists rpe      numeric;             -- esfuerzo percibido 0-10
alter table workout_sets add column if not exists set_type text default 'normal'; -- normal | calentamiento | drop | fallo
alter table workout_sets add column if not exists rest_s   int;                 -- descanso usado (s)
alter table workout_sets add column if not exists tempo    text;                -- tempo opcional (ej: 3-1-1)
