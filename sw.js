// sw.js
const CACHE_NAME = 'pallet-tracker-v5'; // Incremented cache version
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'styles.css',
  'script.js',
  'manifest.json',
  'favicon.ico', 
  'icon.svg',
  'apple-touch-icon.png',
  './pallet_tracker_templates.json' // Added the default templates file
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        const promises = ASSETS_TO_CACHE.map(assetUrl => {
            return cache.add(assetUrl).catch(err => {
                console.error(`[SW] Failed to cache ${assetUrl}:`, err);
            });
        });
        return Promise.all(promises);
      })
      .then(() => {
        console.log('[SW] All core assets cached successfully (or errors logged).');
      })
      .catch(err => console.error('[SW] Error during install phase, caching assets:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return; 
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // If the request is for the default templates JSON and it's in cache, return it.
          return cachedResponse;
        }
        // For other requests or if default templates not in cache, fetch from network.
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response to cache
            // Don't cache non-basic (cross-origin) responses unless specifically handled
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse; 
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => console.error('[SW] Failed to cache new asset:', event.request.url, err));
            return networkResponse;
          }
        ).catch(error => {
          console.error('[SW] Fetch failed:', error, event.request.url);
          // Optionally, you could return a specific offline response for the templates JSON
          // if (event.request.url.endsWith('pallet_tracker_templates.json')) {
          //   return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' }});
          // }
        });
      })
  );
});