const CACHE_NAME = 'eco-green-solar-erp-v1';

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
  '/assets/logo.png',
  '/js/data/purchase-data.js?v=2',
  '/js/data/api.js?v=2',
  '/js/data/sheets-store.js?v=1',
  '/js/pages/dashboard.js?v=2',
  '/js/pages/scansheet.js?v=19',
  '/js/pages/masters.js?v=2',
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
  '/js/app.js?v=2'
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
    event.respondWith(fetch(request));
    return;
  }

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
