// Coin Catalog — Self-Hosted Service Worker
const CACHE = 'coin-catalog-public-v66';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/themes.css',
  './css/components.v2.css',
  './js/app_v2/utils.js',
  './js/app_v2/state.js',
  './js/app_v2/api.js',
  './js/app_v2/themes.js',
  './js/app_v2/catalog.js',
  './js/app_v2/inventory.js',
  './js/app_v2/modals.js',
  './js/app_v2/search.js',
  './js/app_v2/wishlist.js',
  './js/app_v2/images.js',
  './js/app_v2/album.js',
  './js/app_v2/portfolio_history.js',
  './js/app_v2/main.js',
  './js/app_v2/settingsDropdown.js',
  './js/app_v2/infoDropdown.js',
  './js/app_v2/sync.js',
  './js/app_v2/notifications.js',
  './js/app_v2/dexie.js',
  './js/app_v2/db.js',
  './js/app_v2/portfolio.js',
  './js/app_v2/stories.js',
  './data/coins.json',
  './data/stories.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(ASSETS); } catch (e) { /* non-critical assets may fail */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  // Navigation: network-first (fresh HTML always)
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch (err) {
        const cached = await caches.match(event.request);
        return cached || caches.match('/index.html');
      }
    })());
    return;
  }
  // Static assets: network-first for JS (so fixes take effect immediately)
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('.js')) {
    event.respondWith((async () => {
      try {
        const network = await fetch(event.request);
        const cache = await caches.open(CACHE);
        cache.put(event.request, network.clone());
        return network;
      } catch (err) {
        return caches.match(event.request);
      }
    })());
    return;
  }
  // Everything else: cache-first
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