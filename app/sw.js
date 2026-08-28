// Coin Catalog — Self-Hosted Service Worker
// v76: bulletproof auto-update. JS/CSS/HTML/images are all NETWORK-FIRST so any
// fix deployed to the server takes effect on the next load without a manual
// unregister. Bumping CACHE purges all previously-cached (possibly stale) assets.
const CACHE = 'coin-catalog-v129';
const ASSETS = [
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
  '/coin-catalog/app/js/app_v2/modals.js',
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
  '/coin-catalog/app/js/app_v2/dexie.js',
  '/coin-catalog/app/js/app_v2/db.js',
  '/coin-catalog/app/js/app_v2/portfolio.js',
  '/coin-catalog/app/js/app_v2/gallery.js',
  '/coin-catalog/app/js/app_v2/userCoins.js',
  '/coin-catalog/app/js/app_v2/stories.js',
  '/coin-catalog/app/data/coins.json',
  '/coin-catalog/app/data/stories.json',
  '/coin-catalog/app/icons/icon-192.png',
  '/coin-catalog/app/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(ASSETS); } catch (e) { /* non-critical assets may fail */ }
    // Take over immediately so the new worker is in control now.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete every other cache (old versions) so stale assets can't be served.
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network-first: always try the network; fall back to cache only if offline.
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
    // For images, return a 404 response instead of throwing unhandled error to prevent console clutter
    const url = new URL(request.url);
    if (request.destination === 'image' || url.pathname.startsWith('/data/images/') || url.pathname.match(/\.(webp|png|jpg|jpeg|gif|svg)$/i)) {
      return new Response('', { status: 404, statusText: 'Not Found' });
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const _u = new URL(event.request.url);
  // Never cache API or WebDAV calls — always go to network.
  if (event.request.method !== 'GET' || _u.pathname.startsWith('/api/') || _u.pathname.startsWith('/dav/')) {
    return;
  }
  // Navigation: network-first (fresh HTML always).
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  // Static JS: network-first (so fixes take effect immediately).
  if (_u.pathname.endsWith('.js')) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }
  // IMAGES: network-first. Coin images change (upload/delete) and must never be
  // served from a stale cache — this fixes the "black circle won't go away" bug.
  if (_u.pathname.startsWith('/data/images/')) {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  // Everything else (css, json, icons): cache-first for speed.
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
