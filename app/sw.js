// Coin Catalog — Public GitHub Pages Service Worker
// v231: NETWORK-FIRST for JS/JSON/images; cache-first for CSS/icons.
// Bumping CACHE purges all previously-cached (possibly stale) assets.
const CACHE = "coin-catalog-v232";
const BASE = "/coin-catalog/app/";
const ASSETS = [
  BASE,
  BASE + "index.html",
  BASE + "manifest.json",
  BASE + "css/base.css",
  BASE + "css/themes.css",
  BASE + "css/components.v2.css",
  BASE + "js/app_v2/utils.js",
  BASE + "js/app_v2/state.js",
  BASE + "js/app_v2/api.js",
  BASE + "js/app_v2/themes.js",
  BASE + "js/app_v2/catalog.js",
  BASE + "js/app_v2/inventory.js",
  BASE + "js/app_v2/modals.js",
  BASE + "js/app_v2/search.js",
  BASE + "js/app_v2/wishlist.js",
  BASE + "js/app_v2/images.js",
  BASE + "js/app_v2/album.js",
  BASE + "js/app_v2/portfolio_history.js",
  BASE + "js/app_v2/main.js",
  BASE + "js/app_v2/settingsDropdown.js",
  BASE + "js/app_v2/infoDropdown.js",
  BASE + "js/app_v2/sync.js",
  BASE + "js/app_v2/notifications.js",
  BASE + "js/app_v2/dexie.js",
  BASE + "js/app_v2/db.js",
  BASE + "js/app_v2/portfolio.js",
  BASE + "js/app_v2/gallery.js",
  BASE + "js/app_v2/userCoins.js",
  BASE + "js/app_v2/stories.js",
  BASE + "data/coins.json",
  BASE + "data/stories.json",
  BASE + "icons/icon-192.png",
  BASE + "icons/icon-512.png",
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
    if (request.destination === 'image' || url.pathname.startsWith('/coin-catalog/app/data/images/') || url.pathname.match(/\.(webp|png|jpg|jpeg|gif|svg)$/i)) {
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
  if (_u.pathname.startsWith('/coin-catalog/app/data/images/')) {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  // Data files (coins.json, stories.json): network-first for freshness.
  if (_u.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }
  // Static JS: network-first (so fixes take effect immediately).
  if (_u.pathname.endsWith('.js')) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }
  // Everything else (css, icons): cache-first for speed.
});