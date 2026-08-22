const CACHE_NAME = 'eco-green-solar-erp-v64';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/style.css?v=53',
  '/css/modules/base.css?v=53',
  '/css/modules/layout.css?v=53',
  '/css/modules/components.css?v=53',
  '/css/modules/dashboard.css?v=53',
  '/css/modules/responsive.css?v=53',
  '/css/modules/party-ledger.css?v=53',
  '/css/modules/auth.css?v=53',
  '/css/modules/bom.css?v=53',
  '/css/modules/scan-sheet.css?v=53',
  '/assets/icon.ico',
  '/assets/icons/icon-192.png?v=2',
  '/assets/icons/icon-512.png?v=2',
  '/assets/icons/icon-1024.png?v=2',
  '/assets/logo.png',
  '/assets/challan_logo.png',
  '/js/data/purchase-data.js?v=3',
  '/js/data/api.js?v=4',
  '/js/data/sheets-store.js?v=3',
  '/js/pages/dashboard.js?v=6',
  '/js/pages/scansheet.js?v=22',
  '/js/pages/masters.js?v=6',
  '/js/pages/purchase.js?v=5',
  '/js/pages/sales.js?v=9',
  '/js/pages/stockassign.js?v=3',
  '/js/pages/purchaseregister.js?v=3',
  '/js/pages/saleregister.js?v=4',
  '/js/pages/reports.js?v=3',
  '/js/pages/returns.js?v=3',
  '/js/pages/partyledger.js?v=9',
  '/js/pages/lowstock.js?v=4',
  '/js/pages/backup.js?v=3',
  '/js/pages/bom-kit-helpers.js?v=18',
  '/js/pages/bom-challan.js?v=23',
  '/js/pages/bom-challan-map.js?v=3',
  '/js/pages/bom-party-autocomplete.js?v=2',
  '/js/pages/bom-track-register.js?v=4',
  '/js/pages/bom-kit-builder.js?v=2',
  '/js/pages/bom-serial-scan.js?v=3',
  '/js/pages/bom-serial-modal.js?v=4',
  '/js/pages/bom-dispatch.js?v=12',
  '/js/pages/bom.js?v=26',
  '/js/app.js?v=21',
  '/js/theme.js?v=2'
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