// sw.js — PDFStudio™ PWA Service Worker
const CACHE_NAME = 'pdfstudio-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching PDFStudio assets...');
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

// Fetch: smart caching strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── PDF.js worker: cache-first (large, stable file) ──
  if (url.pathname.includes('pdf.worker.min.js')) {
    event.respondWith(
      caches.match(request).then(cached => 
        cached || fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // ── CDN libraries: stale-while-revalidate ──
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(networkRes => {
            if (networkRes.ok) {
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          }).catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ── App files (HTML/CSS/JS/icons): cache-first ──
  if (url.origin === location.origin) {
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
    return;
  }

  // ── Everything else: network-first ──
  event.respondWith(fetch(request));
});

// Optional: Handle background sync for future features
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pdf-ops') {
    event.waitUntil(/* sync logic here */);
  }
});
