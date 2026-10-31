// Service worker — red primero para el código propio, caché para abrir sin señal.
const CACHE = "kratos-gym-renovacion-20261031";
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/config.js', './js/db.js', './js/offline.js', './js/push.js', './js/library.js', './js/foods.js', './js/seed.js',
  './js/evidence.js', './js/logic.js', './js/ui.js', './js/app.js',
  './js/views/hoy.js', './js/views/entreno.js', './js/views/nutricion.js', './js/views/cuerpo.js', './js/views/salud.js', './js/views/ajustes.js',
  './manifest.json', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png'
];
// Sin estas librerías la app no arranca: deben quedar guardadas desde la instalación.
const LIBS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(ASSETS);
    await Promise.all(LIBS.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// ---- Web Push ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Entrenamiento', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Entrenamiento 💪', {
    body: d.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png',
    tag: d.tag, data: { url: d.url || './' }, vibrate: [120, 60, 120]
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus().then(() => c.navigate(url)); }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('supabase.co') || url.includes('openfoodfacts') || e.request.method !== 'GET') return;
  // Same-origin: red primero (cae a caché si estás offline)
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
    );
    return;
  }
  // CDNs y fuentes: caché primero, guardando lo que llega por la red
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(res => {
    const copy = res.clone();
    if (res.ok || res.type === 'opaque') caches.open(CACHE).then(k => k.put(e.request, copy));
    return res;
  })));
});
