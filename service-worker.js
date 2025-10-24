// Nombre de la caché
const CACHE_NAME = 'nacionalizacion-cr-cache-v3'; // <--- VERIFICA Y ACTUALIZA ESTA VERSIÓN

// Archivos para guardar en caché (el "App Shell")
const CACHE_FILES = [
  '.', // Esto cachea el index.html
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'new-logo.png', // <--- AÑADIDA LA NUEVA IMAGEN
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/browser@latest/umd/zxing-browser.min.js'
];

// Evento "install": Se dispara cuando el Service Worker se instala
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando archivos del App Shell');
      return cache.addAll(CACHE_FILES);
    })
  );
});

// Evento "fetch": Se dispara CADA VEZ que la app pide un recurso
self.addEventListener('fetch', (e) => {
  // No cacheamos las peticiones a las APIs (Hacienda, NHTSA)
  if (e.request.url.includes('api.hacienda.go.cr') || e.request.url.includes('vpic.nhtsa.dot.gov')) {
    console.log(`[Service Worker] Petición API (pasa a red): ${e.request.url}`);
    return fetch(e.request);
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      if (response) {
        console.log(`[Service Worker] Sirviendo desde caché: ${e.request.url}`);
        return response;
      }
      console.log(`[Service Worker] Pidiendo a la red: ${e.request.url}`);
      return fetch(e.request);
    })
  );
});
