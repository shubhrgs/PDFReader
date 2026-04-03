// sw.js — epubReaderPro PWA Service Worker
const CACHE_NAME = 'epubreader-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('🗑️ Deleting old cache:', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-only for external APIs
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Dictionary API: network-only (dynamic, small responses)
  if (url.hostname === 'api.dictionaryapi.dev') {
    event.respondWith(fetch(request));
    return;
  }

  // CDN libraries: stale-while-revalidate
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(networkRes => {
            cache.put(request, networkRes.clone());
            return networkRes;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // App files: cache-first
  event.respondWith(
    caches.match(request).then(cached => 
      cached || fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for main page
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
    )
  );
});

// Optional: Handle background sync for future features
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookmarks') {
    event.waitUntil(/* sync logic here */);
  }
});