# Push notifications — guía de despliegue

Las notificaciones tienen dos partes:
- **Ya funciona sin nada más:** activar permiso y el botón **"Probar"** en Ajustes → Notificaciones (notificación local).
- **Recordatorios programados** (entrenar/pesarse/agua aunque la app esté cerrada): requieren desplegar la Edge Function `send-reminders` y programarla. Pasos abajo.

> En **iOS** las push solo llegan si agregas la app a la pantalla de inicio ("Agregar a inicio") y la abres como app instalada. En **Android/escritorio** funciona en el navegador.

## 1. SQL (ya está)
Corre `db/fase2-push.sql` en el SQL Editor. (Crea `push_subscriptions` y la columna `profile.reminders`.)

## 2. Supabase CLI
```powershell
npm install -g supabase
supabase login
supabase link --project-ref ivzzgeoeygggaoazcoeq
```

## 3. Secrets de la función
La clave privada VAPID está en `C:\Users\diego\.openclaw\workspace\kratos\.secrets\vapid.json` (NO en el repo de la app):
```powershell
$v = Get-Content "C:\Users\diego\.openclaw\workspace\kratos\.secrets\vapid.json" | ConvertFrom-Json
supabase secrets set VAPID_PUBLIC=$($v.public) VAPID_PRIVATE=$($v.private) VAPID_SUBJECT=$($v.subject)
supabase secrets set SERVICE_ROLE_KEY=<tu service_role key de Supabase (Project Settings > API)>
```

## 4. Desplegar la función
```powershell
supabase functions deploy send-reminders --no-verify-jwt
```
Quedará en: `https://ivzzgeoeygggaoazcoeq.functions.supabase.co/send-reminders`

## 5. Probar manualmente
Abre esa URL en el navegador (o `curl`). Debe responder `{"ok":true,...}`. Si tienes un recordatorio activo cuya hora cae en los últimos 30 min, te llega la push.

## 6. Programar cada 30 min (pg_cron + pg_net)
En el SQL Editor:
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('kratos-reminders', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://ivzzgeoeygggaoazcoeq.functions.supabase.co/send-reminders',
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
$$);
```
(Para cancelarlo: `select cron.unschedule('kratos-reminders');`)

## Notas
- La función compara la hora configurada con la hora actual en `America/Santiago`, ventana de 30 min → ejecútala cada 30 min.
- Suscripciones caducadas (410/404) se borran solas.
