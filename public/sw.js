// Offline support. Content-hashed build files (assets/name-HASH.ext) never
// change, so they are cache-first. Everything else (pages, art in assets/ with
// stable names) is network-first, falling back to the cache when offline.
const CACHE = 'last-wager-v2';
const HASHED = /\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (HASHED.test(url.pathname)) {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || (req.mode === 'navigate' && (await cache.match('./'))) || Response.error();
      }
    })(),
  );
});
