// Coin Catalog App — Service Worker
// Cache the app shell for offline use
const CACHE = 'coin-catalog-v1';
const STATIC_ASSETS = [
  '/coin-catalog/app/',
  '/coin-catalog/app/index.html',
  '/coin-catalog/app/manifest.json',
  '/coin-catalog/app/css/base.css',
  '/coin-catalog/app/css/themes.css',
  '/coin-catalog/app/css/components.v2.css',
  '/coin-catalog/app/js/app_v2/utils.js',
  '/coin-catalog/app/js/app_v2/state.js',
  '/coin-catalog/app/js/app_v2/api.js',
  '/coin-catalog/app/js/app_v2/themes.js',
  '/coin-catalog/app/js/app_v2/catalog.js',
  '/coin-catalog/app/js/app_v2/inventory.js',
  '/coin-catalog/app/js/app_v2/modals.v2.js',
  '/coin-catalog/app/js/app_v2/search.js',
  '/coin-catalog/app/js/app_v2/wishlist.js',
  '/coin-catalog/app/js/app_v2/images.js',
  '/coin-catalog/app/js/app_v2/album.js',
  '/coin-catalog/app/js/app_v2/portfolio_history.js',
  '/coin-catalog/app/js/app_v2/main.js',
  '/coin-catalog/app/js/app_v2/settingsDropdown.js',
  '/coin-catalog/app/js/app_v2/infoDropdown.js',
  '/coin-catalog/app/js/app_v2/sync.js',
  '/coin-catalog/app/js/app_v2/notifications.js',
  '/coin-catalog/app/js/app_v2/db.js',
  '/coin-catalog/app/icons/icon-192.png',
  '/coin-catalog/app/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached if found, otherwise fetch from network
      return cached || fetch(event.request).then((response) => {
        // Cache successful same-origin responses
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
