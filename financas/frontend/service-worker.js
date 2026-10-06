/**
 * Service Worker — fin.app
 * Estratégia: Cache First para assets estáticos, Network First para API.
 */

const CACHE_NOME = "finapp-v1";
const ASSETS_ESTATICOS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/js/api.js",
  "/js/charts.js",
  "/manifest.json",
];

// ---------------------------------------------------------------------------
// Install: pré-cacheia os assets estáticos
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ASSETS_ESTATICOS))
  );
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate: remove caches antigos
// ---------------------------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NOME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch: Cache First para assets, Network First para API
// ---------------------------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Requisições à API sempre vão para a rede; fallback para cache se offline
  if (url.pathname.startsWith("/api") || url.hostname !== location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          // Salva uma cópia da resposta da API no cache
          const copia = resp.clone();
          caches.open(CACHE_NOME).then((cache) => cache.put(event.request, copia));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets estáticos: Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE_NOME).then((cache) => cache.put(event.request, copia));
        return resp;
      });
    })
  );
});
