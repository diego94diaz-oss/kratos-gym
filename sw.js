// Service worker — network-first para que las actualizaciones lleguen siempre.
const CACHE = 'kratos-gym-v4';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/db.js', './js/seed.js', './js/logic.js', './js/ui.js', './js/app.js',
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
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('supabase') || e.request.method !== 'GET') return;
  // Same-origin: red primero (cae a caché si estás offline)
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(e.request).then(res => {
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
