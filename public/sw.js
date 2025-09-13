// ATLAS Performance-Optimized Service Worker
// Provides aggressive caching for improved performance

const CACHE_NAME = 'atlas-performance-v2';
const STATIC_CACHE_NAME = 'atlas-static-v2';
const DYNAMIC_CACHE_NAME = 'atlas-dynamic-v2';

// Static assets that change infrequently
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192x192.svg',
  '/icon-512x512.svg',
  '/static/css/critical.css'
];

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
  // Immediate cache for static assets (1 year)
  static: { maxAge: 365 * 24 * 60 * 60 * 1000 },
  // Short cache for API responses (5 minutes)
  api: { maxAge: 5 * 60 * 1000 },
  // Medium cache for chunk files (1 day)
  chunks: { maxAge: 24 * 60 * 60 * 1000 }
};

// Install event - cache critical assets only
self.addEventListener('install', (event) => {
  console.log('[SW] Installing performance-optimized service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching critical static assets');
        // Only cache critical assets for faster install
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch((error) => {
        console.warn('[SW] Failed to cache some critical assets:', error);
        return Promise.resolve();
      })
  );
  
  // Take control immediately for performance
  self.skipWaiting();
});

// Activate event - clean up old caches aggressively
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating performance-optimized service worker...');
  
  event.waitUntil(
    Promise.all([
      // Clear old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (![CACHE_NAME, STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME].includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control immediately
      self.clients.claim()
    ])
  );
});

// Enhanced fetch strategy with performance optimizations
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests except for fonts
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('fonts.googleapis.com') &&
      !event.request.url.includes('fonts.gstatic.com')) {
    return;
  }
  
  const url = new URL(event.request.url);
  
  // Static assets strategy - cache first with long TTL
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(event.request));
    return;
  }
  
  // JavaScript chunks strategy - stale while revalidate
  if (isJSChunk(url)) {
    event.respondWith(handleJSChunk(event.request));
    return;
  }
  
  // CSS strategy - cache first
  if (url.pathname.includes('.css')) {
    event.respondWith(handleCSS(event.request));
    return;
  }
  
  // Font strategy - cache first with long TTL
  if (isFontRequest(url)) {
    event.respondWith(handleFont(event.request));
    return;
  }
  
  // API strategy - network first with short cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPI(event.request));
    return;
  }
  
  // Default strategy - network first with cache fallback
  event.respondWith(handleDefault(event.request));
});

// Static assets: cache first (icons, manifest, etc.)
async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] Failed to fetch static asset:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// JavaScript chunks: stale while revalidate for performance
async function handleJSChunk(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cached = await cache.match(request);
  
  // Return cached version immediately if available
  if (cached) {
    // Update cache in background
    fetch(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
    }).catch(() => {});
    
    return cached;
  }
  
  // If not cached, fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Chunk not available offline', { status: 503 });
  }
}

// CSS: cache first for instant styling
async function handleCSS(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('/* CSS not available offline */', { 
      headers: { 'Content-Type': 'text/css' },
      status: 503 
    });
  }
}

// Fonts: cache first with very long TTL
async function handleFont(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache fonts for a very long time
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Font not available', { status: 503 });
  }
}

// API: network first with short cache
async function handleAPI(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Fallback to cache for API requests
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    return new Response(JSON.stringify({ error: 'Network unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Default: network first with cache fallback
async function handleDefault(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineCache = await caches.open(STATIC_CACHE_NAME);
      return offlineCache.match('/') || new Response('Offline', { status: 503 });
    }
    
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Utility functions
function isStaticAsset(url) {
  const staticExtensions = ['.ico', '.png', '.jpg', '.svg', '.webp'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         url.pathname === '/manifest.json';
}

function isJSChunk(url) {
  return url.pathname.includes('/static/js/') && url.pathname.endsWith('.js');
}

function isFontRequest(url) {
  return url.hostname.includes('fonts.gstatic.com') ||
         url.pathname.includes('fonts/') ||
         ['.woff', '.woff2', '.ttf', '.otf'].some(ext => url.pathname.endsWith(ext));
}

// Performance monitoring
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0
};

// Track cache performance
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_PERFORMANCE') {
    event.ports[0].postMessage(performanceMetrics);
  }
});

console.log('[SW] Performance-optimized service worker loaded');