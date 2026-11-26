// ============================================================================
// NUBCONNECT — minimal offline-fallback service worker.
//
// PRIVACY CONTRACT: this worker never caches page content, API responses or
// any private data. It precaches ONLY the static offline page and brand
// icons. Navigation requests are always network-first; when the network
// fails, the offline page is served instead.
// ============================================================================
const CACHE = 'nubconnect-v1';
const PRECACHE = ['/offline.html', '/icon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle top-level navigations, network-first. Nothing is cached on
  // success — student data never touches the Cache Storage API.
  if (req.method !== 'GET' || req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req).catch(() =>
      caches.match('/offline.html').then((res) => res || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })),
    ),
  );
});
