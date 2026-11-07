// ============================================================
//  Edge Function: send-reminders
//  Envía recordatorios Web Push según profile.reminders.
//  Pensada para ejecutarse periódicamente (cada 30 min) vía cron.
//  Secrets requeridos: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, SERVICE_ROLE_KEY,
//  ECOSISTEMA_CRON_SECRET (desde 2026-11-07: solo el cron, que la manda en el encabezado
//  x-cron-secret, puede dispararla; antes cualquiera con la URL podía mandar avisos).
// ============================================================
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:diego94diaz@gmail.com';
const CRON_SECRET = Deno.env.get('ECOSISTEMA_CRON_SECRET') ?? '';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Minuto del día en zona horaria de Diego
function nowMinutesSantiago(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const h = +(parts.find(p => p.type === 'hour')?.value ?? '0');
  const m = +(parts.find(p => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}
const hm = (s: string) => { const [h, m] = String(s || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

function dueReminders(rem: any, now: number, win = 30) {
  const out: { kind: string; title: string; body: string }[] = [];
  const inWin = (t: number) => now - t >= 0 && now - t < win;
  if (rem?.entrenar?.on && inWin(hm(rem.entrenar.hora))) out.push({ kind: 'entrenar', title: 'Hora de entrenar 🏋️', body: 'Tu sesión de hoy te espera. ¡Vamos!' });
  if (rem?.pesarse?.on  && inWin(hm(rem.pesarse.hora)))  out.push({ kind: 'pesarse', title: 'Pésate ⚖️', body: 'Registra tu peso en ayunas para tu curva.' });
  if (rem?.comidas?.on  && inWin(hm(rem.comidas.hora)))  out.push({ kind: 'comidas', title: 'Anota tus comidas 🍽️', body: 'Hoy aún no registras nada.' });
  if (rem?.agua?.on     && inWin(hm(rem.agua.hora || '16:00'))) out.push({ kind: 'agua', title: 'Hidratación 💧', body: '¿Vas al día con el agua?' });
  return out;
}

// Fecha de hoy en Chile
const todaySantiago = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const any = async (table: string, user: string, fecha: string, extra: Record<string, string> = {}) => {
  let q = sb.from(table).select('fecha', { count: 'exact', head: true }).eq('user_id', user).eq('fecha', fecha);
  for (const [k, v] of Object.entries(extra)) q = q.eq(k, v);
  return ((await q).count ?? 0) > 0;
};
// Descarta lo que ya está hecho hoy
async function stillNeeded(kind: string, user: string, fecha: string) {
  if (kind === 'entrenar') return !(await any('workout_sets', user, fecha)) && !(await any('cardio_sessions', user, fecha));
  if (kind === 'pesarse') return !(await any('salud_mediciones', user, fecha, { tipo: 'peso' }));
  if (kind === 'comidas') return !(await any('food_logs', user, fecha));
  if (kind === 'agua') {
    const { data } = await sb.from('salud_mediciones').select('valor').eq('user_id', user).eq('fecha', fecha).eq('tipo', 'agua');
    return (data ?? []).reduce((a: number, r: any) => a + Number(r.valor || 0), 0) < 1000;
  }
  return true;
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'no autorizado' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const now = nowMinutesSantiago();
  const { data: profiles } = await sb.from('profile').select('user_id, reminders').not('reminders', 'is', null);
  let sent = 0;
  for (const p of profiles ?? []) {
    const fecha = todaySantiago(), user = (p as any).user_id, due = [];
    for (const n of dueReminders((p as any).reminders, now)) if (await stillNeeded(n.kind, user, fecha)) due.push(n);
    if (!due.length) continue;
    const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', (p as any).user_id);
    for (const s of subs ?? []) {
      const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      for (const n of due) {
        try { await webpush.sendNotification(sub, JSON.stringify({ ...n, url: './' })); sent++; }
        catch (e: any) { if (e?.statusCode === 410 || e?.statusCode === 404) await sb.from('push_subscriptions').delete().eq('id', s.id); }
      }
    }
  }
  return new Response(JSON.stringify({ ok: true, now, sent }), { headers: { 'content-type': 'application/json' } });
});
