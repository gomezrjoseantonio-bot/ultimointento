// ATLAS PWA Service Worker
// Provides basic caching for offline functionality

const CACHE_VERSION = 'atlas-pwa-v3';
const STATIC_CACHE = `atlas-static-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192x192.svg',
  '/icon-512x512.svg'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch((error) => {
              console.warn(`[SW] Failed to precache ${url}:`, error);
            })
          )
        );
      })
      .catch((error) => {
        console.warn('[SW] Failed to cache some assets:', error);
        // Don't fail the install if some assets can't be cached
        return Promise.resolve();
      })
  );
  
  // Take control immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all pages
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const { request } = event;
  const requestUrl = new URL(request.url);

  // Network-first strategy for navigation requests to ensure the latest UI
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(STATIC_CACHE)
            .then((cache) => cache.put(request, responseClone))
            .catch((error) => console.warn('[SW] Failed to update navigation cache:', error));
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return cache.match('/index.html');
        })
    );
    return;
  }

  // Cache-first strategy for known static assets
  if (PRECACHE_URLS.includes(requestUrl.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE)
                .then((cache) => cache.put(request, responseClone))
                .catch((error) => console.warn('[SW] Failed to cache static asset:', error));
            }
            return networkResponse;
          })
          .catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // For other requests, use network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(STATIC_CACHE)
            .then((cache) => cache.put(request, responseClone))
            .catch((error) => console.warn('[SW] Failed to cache response:', error));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// Message event - for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service worker script loaded');
