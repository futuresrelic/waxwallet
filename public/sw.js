// ─── WAX Wallet Viewer — Service Worker ──────────────────────────────────────
// Network-first for /api/* (fresh data is essential).
// Cache-first for everything else (app shell + static assets).

const CACHE = 'wax-wallet-v1';

self.addEventListener('install', (event) => {
  // Pre-cache the app shell (just the root page)
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/')));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete old cache versions
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // Network-first: always try the network, fall back to cache
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r ?? Response.error())),
    );
    return;
  }

  // Cache-first: serve from cache if available, otherwise fetch + cache
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        }),
    ),
  );
});
