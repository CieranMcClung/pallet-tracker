const CACHE_NAME = 'pallet-tracker-v3.0'; // MUST MATCH version.json
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'styles.css',
  'palletLocatorPlus.css',
  'firebase-config.js',
  'manifest.json',
  'icons/favicon.ico',
  'icons/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'version.json',
  // JS Modules
  'firebaseService.js',
  'appState.js',
  'domElements.js',
  'utils.js',
  'uiModal.js',
  'featureTemplates.js',
  'featurePlanPackShipments.js',
  'featurePlanPackSkus.js',
  'featureQuickCount.js',
  'tasks.js',
  'dashboard.js', // New
  'accounts.js', // New
  'palletLocatorPlus.js',
  'uiMain.js',
  'settings.js',
  'mainScript.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core assets');
        const promises = ASSETS_TO_CACHE.map(assetUrl => {
            let requestUrl = (assetUrl === './') ? 'index.html' : assetUrl;
            if (!requestUrl.endsWith('.html') && !requestUrl.endsWith('.json')) {
                requestUrl += '?v=' + CACHE_NAME;
            }
            const request = new Request(requestUrl, { cache: 'reload' });
            return cache.add(request).catch(err => console.error(`[SW] Failed to cache ${assetUrl}:`, err));
        });
        return Promise.all(promises);
      })
      .then(() => console.log('[SW] All core assets cached successfully.'))
      .catch(err => console.error('[SW] Error during install, asset caching failed:', err))
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
    }).then(() => {
      console.log('[SW] Old caches cleared. Claiming clients.');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET') return; 

  if (requestUrl.hostname.includes('firestore.googleapis.com') ||
      requestUrl.hostname.includes('firebasestorage.googleapis.com') ||
      requestUrl.pathname.endsWith('version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }) 
      .catch(error => {
        console.warn(`[SW] Network fetch failed for ${requestUrl.pathname}:`, error);
        if (requestUrl.pathname.endsWith('version.json')) {
          return caches.match(event.request).then(cachedResponse => 
            cachedResponse || new Response(JSON.stringify({ version: "offline-fallback" }), { headers: { 'Content-Type': 'application/json' }})
          );
        }
        throw error;
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.ok && requestUrl.origin === self.location.origin) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(error => {
          console.warn('[SW] Network request failed for:', event.request.url, error);
          if (event.request.mode === 'navigate' && !cachedResponse) {
            console.log('[SW] Serving index.html as fallback for navigation.');
            return caches.match('index.html');
          }
          if (!cachedResponse) throw error; 
          return cachedResponse;
        });
        return cachedResponse || fetchPromise;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_SW_UPDATE') {
    fetch('version.json?t=' + new Date().getTime()) 
      .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch version.json'))
      .then(serverVersionInfo => {
        if (serverVersionInfo.version !== CACHE_NAME) {
          console.log(`[SW] New version available. Server: ${serverVersionInfo.version}, Client Cache: ${CACHE_NAME}. Notifying.`);
          self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
            clients.forEach(client => client.postMessage({ type: 'SW_UPDATE_READY', payload: { message: 'New version available!' } }));
          });
        } else {
          console.log('[SW] Already latest version:', CACHE_NAME);
        }
      }).catch(err => console.error('[SW] Error checking version.json:', err));
  } else if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING. Activating new SW.');
    self.skipWaiting();
  }
});