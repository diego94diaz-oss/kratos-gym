// Service worker — cache del shell para PWA offline
const CACHE = 'kratos-gym-v1';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/config.js', './js/db.js', './js/seed.js', './js/logic.js', './js/ui.js', './js/app.js',
  './manifest.json', './assets/icon.svg'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  // No cachear llamadas a Supabase / CDNs dinámicos
  if (url.includes('supabase') || e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (url.startsWith(self.location.origin)) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
