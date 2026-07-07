const CACHE_NAME = 'fm-v2-cache-v1';
const PRECACHE_URLS = [
  '/app-v2/',
  '/app-v2/index.html',
  '/app-v2/styles/tokens.css',
  '/app-v2/styles/app.css',
  '/app-v2/styles/animations.css',
  '/app-v2/scripts/app.js',
  '/app-v2/scripts/state.js',
  '/app-v2/scripts/api.js',
  '/app-v2/scripts/dolar.js',
  '/app-v2/scripts/search.js',
  '/app-v2/scripts/portfolio.js',
  '/app-v2/scripts/auth.js',
  '/app-v2/scripts/router.js',
  '/app-v2/icons/icon-192.svg',
  '/app-v2/icons/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  if (url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://fonts.gstatic.com' ||
      url.origin === 'https://cdn.jsdelivr.net' ||
      url.origin === 'https://cdnjs.cloudflare.com') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
