// Service worker — network-first para que las actualizaciones lleguen siempre.
const CACHE = 'kratos-gym-v25';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/db.js', './js/offline.js', './js/push.js', './js/library.js', './js/seed.js', './js/logic.js', './js/ui.js', './js/app.js',
  './manifest.json', './assets/icon.svg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// ---- Web Push ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Kratos Gym', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Kratos Gym 💪', {
    body: d.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png',
    tag: d.tag, data: { url: d.url || './' }, vibrate: [120, 60, 120]
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('supabase') || url.includes('openfoodfacts') || e.request.method !== 'GET') return;
  // Same-origin: red primero (cae a caché si estás offline)
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // CDNs externos: caché primero
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
