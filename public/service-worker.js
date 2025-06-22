// Service Worker for Pokemon TCG Deck Builder
// Implements advanced caching strategies and offline functionality

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  static: `static-cache-${CACHE_VERSION}`,
  dynamic: `dynamic-cache-${CACHE_VERSION}`,
  images: `image-cache-${CACHE_VERSION}`,
  api: `api-cache-${CACHE_VERSION}`,
};

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/_next/static/css/app.css',
  '/_next/static/chunks/main.js',
  '/_next/static/chunks/webpack.js',
  '/_next/static/chunks/framework.js',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fallback to cache
  networkFirst: async (request, cacheName) => {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  },

  // Cache first, fallback to network
  cacheFirst: async (request, cacheName) => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Refresh cache in background
      fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
          caches.open(cacheName).then(cache => {
            cache.put(request, networkResponse);
          });
        }
      });
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  },

  // Stale while revalidate
  staleWhileRevalidate: async (request, cacheName) => {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        caches.open(cacheName).then(cache => {
          cache.put(request, networkResponse.clone());
        });
      }
      return networkResponse;
    });
    
    return cachedResponse || fetchPromise;
  },

  // Network only
  networkOnly: async (request) => {
    return fetch(request);
  },
};

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAMES.static).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => {
            return !Object.values(CACHE_NAMES).includes(cacheName);
          })
          .map(cacheName => {
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy based on request
  let strategy;
  let cacheName;

  if (request.method !== 'GET') {
    // Don't cache non-GET requests
    strategy = CACHE_STRATEGIES.networkOnly;
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - network first
    strategy = CACHE_STRATEGIES.networkFirst;
    cacheName = CACHE_NAMES.api;
  } else if (request.destination === 'image') {
    // Images - cache first
    strategy = CACHE_STRATEGIES.cacheFirst;
    cacheName = CACHE_NAMES.images;
  } else if (url.pathname.startsWith('/_next/static/')) {
    // Static assets - cache first
    strategy = CACHE_STRATEGIES.cacheFirst;
    cacheName = CACHE_NAMES.static;
  } else {
    // Everything else - stale while revalidate
    strategy = CACHE_STRATEGIES.staleWhileRevalidate;
    cacheName = CACHE_NAMES.dynamic;
  }

  event.respondWith(
    strategy(request, cacheName).catch(() => {
      // Fallback to offline page for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/offline.html');
      }
      throw new Error('Network request failed');
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-decks') {
    event.waitUntil(syncDecks());
  } else if (event.tag === 'sync-collection') {
    event.waitUntil(syncCollection());
  }
});

// Periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-prices') {
    event.waitUntil(updatePrices());
  }
});

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
  };

  event.waitUntil(
    self.registration.showNotification('Pokemon TCG Deck Builder', options)
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});

// Helper functions

async function syncDecks() {
  // Get pending deck updates from IndexedDB
  const pendingUpdates = await getPendingDeckUpdates();
  
  for (const update of pendingUpdates) {
    try {
      const response = await fetch('/api/deck-builder/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      
      if (response.ok) {
        await removePendingUpdate(update.id);
      }
    } catch (error) {
      console.error('Failed to sync deck:', error);
    }
  }
}

async function syncCollection() {
  // Similar to syncDecks but for collection updates
}

async function updatePrices() {
  // Fetch latest price updates
  try {
    const response = await fetch('/api/prices/update');
    if (response.ok) {
      const prices = await response.json();
      // Update price cache
      const cache = await caches.open(CACHE_NAMES.api);
      cache.put('/api/prices', new Response(JSON.stringify(prices)));
    }
  } catch (error) {
    console.error('Failed to update prices:', error);
  }
}

async function getPendingDeckUpdates() {
  // This would interface with IndexedDB
  return [];
}

async function removePendingUpdate(id) {
  // Remove from IndexedDB
}

// Cache size management
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const keysToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

// Periodic cache cleanup
setInterval(async () => {
  await trimCache(CACHE_NAMES.images, 100);
  await trimCache(CACHE_NAMES.dynamic, 50);
  await trimCache(CACHE_NAMES.api, 30);
}, 60 * 60 * 1000); // Every hour