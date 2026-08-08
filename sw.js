const CACHE_NAME = 'eco-green-solar-erp-v4';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/style.css?v=19',
  '/css/modules/base.css',
  '/css/modules/layout.css',
  '/css/modules/components.css',
  '/css/modules/responsive.css',
  '/css/modules/party-ledger.css',
  '/css/modules/auth.css',
  '/css/modules/bom.css',
  '/css/modules/scan-sheet.css',
  '/assets/icon.ico',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-1024.png',
  '/assets/logo.png',
  '/js/data/purchase-data.js?v=2',
  '/js/data/api.js?v=3',
  '/js/data/sheets-store.js?v=1',
  '/js/pages/dashboard.js?v=3',
  '/js/pages/scansheet.js?v=19',
  '/js/pages/masters.js?v=3',
  '/js/pages/purchase.js?v=2',
  '/js/pages/sales.js?v=2',
  '/js/pages/stockassign.js?v=2',
  '/js/pages/purchaseregister.js?v=2',
  '/js/pages/saleregister.js?v=2',
  '/js/pages/reports.js?v=2',
  '/js/pages/returns.js?v=2',
  '/js/pages/partyledger.js?v=2',
  '/js/pages/lowstock.js?v=2',
  '/js/pages/backup.js?v=2',
  '/js/pages/bom.js?v=2',
  '/js/app.js?v=3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    // `cache: 'no-store'` bypasses the browser's own HTTP cache too — not
    // just the service worker's Cache Storage. Plain fetch(request) still
    // respects the browser's heuristic HTTP caching for GET responses that
    // don't send explicit Cache-Control headers (e.g. the challan PDF
    // route), which is why the installed PWA could serve a stale response
    // even though this handler never touches caches.* itself.
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // ---------------------------------------------------------------------
  // HTML shell (the page itself: navigations + '/' + '/index.html') —
  // NETWORK-FIRST. This is the fix for "mobile still shows the old app
  // after a deploy": the old cache-first logic below served index.html
  // straight from cache forever, so the browser never even saw that the
  // <script src="...?v=N"> tags on the server had changed — it kept
  // requesting the same old-versioned JS files that were already cached.
  // Network-first means every load checks the server first for the latest
  // shell; only falls back to the cached copy if the network request fails
  // (e.g. offline), so the PWA still works without a connection.
  // ---------------------------------------------------------------------
  const isHtmlShell = request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
  if (isHtmlShell) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else (JS/CSS/images) — cache-first is safe here because
  // these URLs carry ?v=N query strings; a changed file gets a NEW URL
  // from the freshly-fetched index.html above, so it's a cache miss and
  // gets fetched + cached fresh automatically. No stale-forever risk.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          const shouldCache =
            networkResponse &&
            networkResponse.ok &&
            url.origin === self.location.origin;

          if (shouldCache) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }

          return networkResponse;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});