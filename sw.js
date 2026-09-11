const CACHE_NAME = 'sales-calc-v2'; // <--- Palitan ang version number dito (e.g. v1 to v2)

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Agad na gagamitin ang bagong bersyon
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache); // Binubura ang lumang cache
                    }
                })
            );
        })
    );
});
