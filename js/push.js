// ============================================================
//  PUSH — Suscripción Web Push (cliente)
//  La clave VAPID pública viene de config.js; la privada vive
//  como secret de la Edge Function que envía los recordatorios.
// ============================================================
const Push = (() => {
  const VAPID = (window.KRATOS_CONFIG || {}).VAPID_PUBLIC;

  function supported(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function permission(){ return supported() ? Notification.permission : 'unsupported'; }
  function b64ToU8(s){
    const pad = '='.repeat((4 - s.length % 4) % 4);
    const b = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }
  async function reg(){ return await navigator.serviceWorker.ready; }

  async function isSubscribed(){
    if (!supported()) return false;
    try { const r = await reg(); return !!(await r.pushManager.getSubscription()); } catch { return false; }
  }
  async function enable(){
    if (!supported()) throw new Error('Este navegador/dispositivo no soporta notificaciones push.');
    if (!VAPID) throw new Error('Falta la clave VAPID en config.js.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Permiso de notificaciones denegado.');
    const r = await reg();
    let sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID) });
    await DB.savePushSub(sub);
    return true;
  }
  async function disable(){
    const r = await reg();
    const sub = await r.pushManager.getSubscription();
    if (sub){ try { await DB.deletePushSub(sub.endpoint); } catch {} await sub.unsubscribe(); }
  }
  async function test(){
    if (permission() !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') throw new Error('Permiso denegado.'); }
    const r = await reg();
    await r.showNotification('Kratos Gym 💪', { body: 'Notificaciones activas. ¡A darle!', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', vibrate: [120,60,120] });
  }

  return { supported, permission, isSubscribed, enable, disable, test };
})();
