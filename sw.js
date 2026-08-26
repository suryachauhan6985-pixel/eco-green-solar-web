const CACHE_NAME = 'eco-green-solar-erp-v200';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/css/style.css?v=200',
  '/css/modules/base.css?v=200',
  '/css/modules/layout.css?v=200',
  '/css/modules/components.css?v=200',
  '/css/modules/dashboard.css?v=200',
  '/css/modules/responsive.css?v=200',
  '/css/modules/party-ledger.css?v=200',
  '/css/modules/auth.css?v=200',
  '/css/modules/bom.css?v=200',
  '/css/modules/scan-sheet.css?v=200',
  '/css/modules/tenant-theme.css?v=200',
  '/css/modules/template-designer.css?v=200',
  '/assets/icon.ico',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-1024.png',
  '/assets/logo.png',
  '/assets/challan_logo.png',
  '/js/data/purchase-data.js?v=190',
  '/js/data/api.js?v=190',
  '/js/data/sheets-store.js?v=190',
  '/js/data/items.js?v=190',
  '/js/data/bom-kits.js?v=190',
  '/js/data/validators.js?v=190',
  '/js/components/header.js?v=190',
  '/js/components/modal.js?v=190',
  '/js/components/sidebar.js?v=190',
  '/js/pages/auth.js?v=190',
  '/js/pages/dashboard.js?v=190',
  '/js/pages/purchase.js?v=190',
  '/js/pages/masters.js?v=190',
  '/js/pages/sales.js?v=190',
  '/js/pages/scansheet.js?v=190',
  '/js/pages/settings.js?v=190',
  '/js/pages/users.js?v=190',
  '/js/pages/stockassign.js?v=190',
  '/js/pages/purchaseregister.js?v=190',
  '/js/pages/saleregister.js?v=190',
  '/js/pages/reports.js?v=190',
  '/js/pages/returns.js?v=190',
  '/js/pages/vouchers.js?v=190',
  '/js/pages/financialreports.js?v=190',
  '/js/pages/partyledger.js?v=192',
  '/js/pages/lowstock.js?v=190',
  '/js/pages/backup.js?v=190',
  '/js/pages/saas_tenants.js?v=190',
  '/js/pages/template_designer.js?v=190',
  '/js/pages/bom-kit-helpers.js?v=200',
  '/js/pages/bom-challan.js?v=200',
  '/js/pages/bom-challan-map.js?v=200',
  '/js/pages/bom-party-autocomplete.js?v=200',
  '/js/pages/bom-track-register.js?v=200',
  '/js/pages/bom-kit-builder.js?v=200',
  '/js/pages/bom-serial-scan.js?v=200',
  '/js/pages/bom-serial-modal.js?v=200',
  '/js/pages/bom-dispatch.js?v=200',
  '/js/pages/bom.js?v=200',
  '/js/utils/password-policy.js?v=200',
  '/js/core/ui-feedback.js?v=200',
  '/js/core/pwa-permissions.js?v=200',
  '/js/core/auth-session.js?v=200',
  '/js/core/settings-panel.js?v=200',
  '/js/core/navigation-engine.js?v=200',
  '/js/app.js?v=200',
  '/js/theme.js?v=200'
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

  // 3. Static assets (JS/CSS/images/fonts) — Network-first with cache fallback
  // This guarantees PWA always gets fresh deployed assets on regular launch
  event.respondWith(
    fetch(request)
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
      .catch(() => {
        return caches.match(request);
      })
  );
});

// 4. PUSH NOTIFICATIONS & INTERACTIVE CLICK HANDLERS
self.addEventListener('push', (event) => {
  let payload = { title: 'Eco Green Solar Alert', body: 'New enterprise operational update.', icon: '/assets/icons/icon-192.png' };
  try {
    if (event.data) {
      payload = Object.assign(payload, event.data.json());
    }
  } catch (e) {
    if (event.data) payload.body = event.data.text();
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
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