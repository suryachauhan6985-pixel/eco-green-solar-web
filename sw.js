const CACHE_NAME = 'eco-green-solar-erp-v117';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/style.css?v=98',
  '/css/modules/base.css?v=98',
  '/css/modules/layout.css?v=98',
  '/css/modules/components.css?v=98',
  '/css/modules/dashboard.css?v=98',
  '/css/modules/responsive.css?v=98',
  '/css/modules/party-ledger.css?v=98',
  '/css/modules/auth.css?v=98',
  '/css/modules/bom.css?v=98',
  '/css/modules/scan-sheet.css?v=98',
  '/assets/icon.ico',
  '/assets/icons/icon-192.png?v=2',
  '/assets/icons/icon-512.png?v=2',
  '/assets/icons/icon-1024.png?v=2',
  '/assets/logo.png',
  '/assets/challan_logo.png',
  '/js/data/purchase-data.js?v=3',
  '/js/data/api.js?v=5',
  '/js/data/sheets-store.js?v=4',
  '/js/pages/dashboard.js?v=9',
  '/js/pages/scansheet.js?v=25',
  '/js/pages/masters.js?v=10',
  '/js/pages/purchase.js?v=7',
  '/js/pages/sales.js?v=9',
  '/js/pages/stockassign.js?v=3',
  '/js/pages/purchaseregister.js?v=3',
  '/js/pages/saleregister.js?v=4',
  '/js/pages/reports.js?v=3',
  '/js/pages/returns.js?v=3',
  '/js/pages/partyledger.js?v=20',
  '/js/pages/lowstock.js?v=4',
  '/js/pages/backup.js?v=4',
  '/js/pages/bom-kit-helpers.js?v=20',
  '/js/pages/bom-challan.js?v=23',
  '/js/pages/bom-challan-map.js?v=3',
  '/js/pages/bom-party-autocomplete.js?v=2',
  '/js/pages/bom-track-register.js?v=5',
  '/js/pages/bom-kit-builder.js?v=2',
  '/js/pages/bom-serial-scan.js?v=3',
  '/js/pages/bom-serial-modal.js?v=4',
  '/js/pages/bom-dispatch.js?v=14',
  '/js/pages/bom.js?v=32',
  '/js/app.js?v=51',
  '/js/theme.js?v=5'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          APP_SHELL.map((url) =>
            fetch(url).then((res) => {
              if (res && res.ok) return cache.put(url, res);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER cache any /api/... calls (DB data must be 100% fresh)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. App shell (/ or /index.html) — Network-first with cache fallback
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

  // 3. Static assets (JS/CSS/images/fonts) — Cache-first with network fallback
  // NEVER fall back to /index.html for static assets (which would cause SyntaxError: Unexpected token '<')
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        const shouldCache =
          networkResponse &&
          networkResponse.ok &&
          url.origin === self.location.origin;

        if (shouldCache) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }

        return networkResponse;
      });
    })
  );
});

// 3. PUSH NOTIFICATIONS & INTERACTIVE CLICK HANDLERS
self.addEventListener('push', (event) => {
  let payload = { title: 'Eco Green Solar Alert', body: 'New enterprise operational update.', icon: '/assets/icons/icon-192.png?v=2' };
  try {
    if (event.data) {
      payload = Object.assign(payload, event.data.json());
    }
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/assets/icons/icon-192.png?v=2',
    badge: '/assets/icons/icon-192.png?v=2',
    vibrate: [200, 100, 200],
    data: payload.url || '/'
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});