// Coin Catalog App PWA — Service Worker
// Cache static assets for offline use, but always fetch the app shell fresh
const CACHE = 'coin-catalog-v2';
const ASSETS = [
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
  '/coin-catalog/app/js/app_v2/portfolio.js',
  '/coin-catalog/app/js/app_v2/stories.js',
  '/coin-catalog/app/icons/icon-192.png',
  '/coin-catalog/app/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Only cache what we know is safe — no index.html or root paths
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // For navigation (HTML pages): network-first, fall back to cached
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put(event.request, network.clone());
        return network;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Last resort: try index.html cache
        return caches.match('/coin-catalog/app/index.html');
      }
    })());
    return;
  }

  // For static assets (JS, CSS, images): cache-first
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    
    const network = await fetch(event.request);
    if (network.ok && url.origin === self.location.origin) {
      const cache = await caches.open(CACHE);
      cache.put(event.request, network.clone());
    }
    return network;
  })());
});