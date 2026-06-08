const CACHE_NAME = "velora-v2";
const ASSETS = [
    "index.html",
    "styles.css",
    "app.js",
    "manifest.json",
    "icon.svg"
];

// Install Event
self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate Event
self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event (Cache-first, network fallback)
self.addEventListener("fetch", (e) => {
    e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Fetch fresh copy in background to update cache (stale-while-revalidate)
                fetch(e.request)
                    .then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
                        }
                    })
                    .catch(() => { /* Ignore background fetch failure */ });
                
                return cachedResponse;
            }
            return fetch(e.request);
        })
    );
});
