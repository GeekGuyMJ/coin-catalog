// Coin Catalog — Public Service Worker
// NETWORK-FIRST for JS and images so fixes deploy immediately
const CACHE = 'coin-catalog-v96';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/themes.css',
  '/css/components.v2.css',
  '/js/app_v2/utils.js',
  '/js/app_v2/state.js',
  '/js/app_v2/api.js',
  '/js/app_v2/themes.js',
  '/js/app_v2/catalog.js',
  '/js/app_v2/inventory.js',
  '/js/app_v2/modals.v2.js',
  '/js/app_v2/search.js',
  '/js/app_v2/wishlist.js',
  '/js/app_v2/images.js',
  '/js/app_v2/album.js',
  '/js/app_v2/portfolio_history.js',
  '/js/app_v2/main.js',
  '/js/app_v2/settingsDropdown.js',
  '/js/app_v2/infoDropdown.js',
  '/js/app_v2/sync.js',
  '/js/app_v2/notifications.js',
  '/js/app_v2/dexie.js',
  '/js/app_v2/db.js',
  '/js/app_v2/portfolio.js',
  '/js/app_v2/stories.js',
  '/data/coins.json',
  '/data/stories.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
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

// Network-first: always try network; fall back to cache only if offline
async function networkFirst(request, cacheable) {
  const cache = await caches.open(CACHE);
  try {
    const network = await fetch(request);
    if (cacheable && network.ok && (new URL(request.url)).origin === self.location.origin) {
      cache.put(request, network.clone());
    }
    return network;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // For images, return 404 instead of throwing
    const url = new URL(request.url);
    if (request.destination === 'image' || url.pathname.startsWith('/data/images/') || url.pathname.match(/\.(webp|png|jpg|jpeg|gif|svg)$/i)) {
      return new Response('', { status: 404, statusText: 'Not Found' });
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const _u = new URL(event.request.url);
  // Never cache API calls
  if (event.request.method !== 'GET' || _u.pathname.startsWith('/api/')) {
    return;
  }
  // Navigation: network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  // Static JS: network-first
  if (_u.pathname.endsWith('.js')) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }
  // IMAGES: network-first
  if (_u.pathname.startsWith('/data/images/')) {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  // Everything else: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const network = await fetch(event.request);
      if (network.ok && _u.origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, network.clone());
      }
      return network;
    } catch (e) {
      if (event.request.destination === 'image') {
        return new Response('', { status: 404, statusText: 'Not Found' });
      }
      throw e;
    }
  })());
});