const CACHE = 'finapp-v2';
const PRECACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/app.js',
  '/js/api.js',
  '/js/mock.js',
  '/js/utils.js',
  '/js/icons.js',
  '/js/charts.js',
  '/js/views/shared.js',
  '/js/views/dashboard.js',
  '/js/views/lancamentos.js',
  '/js/views/novo.js',
  '/js/views/cartoes.js',
  '/js/views/investimentos.js',
  '/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const clone = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, clone));
      return res;
    }))
  );
});
