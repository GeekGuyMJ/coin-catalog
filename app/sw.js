// Coin Catalog — Public GitHub Pages Service Worker
// v269: NETWORK-FIRST for JS/JSON/images; cache-first for CSS/icons.
// Bumping CACHE purges all previously-cached (possibly stale) assets.
const CACHE = "coin-catalog-v269";
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
    const url = new URL(request.url);
    if (request.destination === 'image' || url.pathname.startsWith('/data/images/') || url.pathname.match(/\.(webp|png|jpg|jpeg|gif|svg)$/i)) {
      return new Response('', { status: 404, statusText: 'Not Found' });
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const u = new URL(event.request.url);
  if (event.request.method !== 'GET' || u.pathname.startsWith('/api/') || u.pathname.startsWith('/dav/')) {
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  if (u.pathname.endsWith('.js')) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }
  if (u.pathname.startsWith('/data/images/') || u.pathname.startsWith(BASE + 'data/images/')) {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  if (u.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(event.request, true));
    return;
  }
});