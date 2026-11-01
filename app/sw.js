// Coin Catalog — Public GitHub Pages Service Worker
// v271: NETWORK-FIRST for JS/JSON/images; cache-first for CSS/icons.
// Bumping CACHE purges all previously-cached (possibly stale) assets.
const CACHE = "coin-catalog-v514";
// GGMJ-460: Dynamic base path — GitHub Pages serves from /coin-catalog/app/,
// Cloudflare Pages and self-hosted serve from root /. Derive from the SW's
// own location so it works on all deployments.
const BASE = new URL("./", self.location).pathname;
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
  BASE + "js/app_v2/env.js",
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
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    const allowed = new Set(ASSETS.map(a => new URL(a, self.location).href));
    await Promise.all(keys.map(k => { if (!allowed.has(k.url)) cache.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin requests to our app path
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  const isJS = url.pathname.endsWith('.js');
  const isJSON = url.pathname.endsWith('.json');
  const isCSS = url.pathname.endsWith('.css');
  const isIcon = url.pathname.match(/\.(ico|png|svg|webp)$/);

  // CSS and icons: cache-first (they're versioned in CACHE name)
  if (isCSS || isIcon) {
    event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
    return;
  }

  // JS/JSON: network-first (always fresh code/data), fallback to cache
  if (isJS || isJSON) {
    event.respondWith((async () => {
      try {
        const resp = await fetch(event.request, { cache: 'no-cache' });
        if (resp.ok) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, resp.clone());
        }
        return resp;
      } catch (e) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Other: network-first
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
