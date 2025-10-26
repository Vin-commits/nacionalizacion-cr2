// Nombre de la caché
const CACHE_NAME = 'nacionalizacion-cr-cache-v21'; // CAMBIO V4

// Archivos para guardar en caché (el "App Shell")
const CACHE_FILES = [
  '.',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'new-logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@zxing/browser@latest/umd/zxing-browser.min.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js' // <-- AÑADIDA
];
  // --- FIN LÍNEAS AÑADIDAS ---
];

// Evento "install": Se dispara cuando el Service Worker se instala
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando archivos del App Shell');
      // Agregamos todos los archivos definidos a la caché
      // 'add' se salta los que fallan, 'addAll' falla si uno falla.
      // Vamos a ser más robustos con 'add'
      return Promise.all(
        CACHE_FILES.map(url => {
            return cache.add(url).catch(reason => {
                console.warn(`[Service Worker] Falló al cachear: ${url}`, reason);
            });
        })
      );
    })
  );
});

// Evento "activate": Se dispara cuando el nuevo Service Worker se activa
// Este es el lugar para limpiar cachés antiguas.
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activando...');
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Eliminando caché antigua:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});


// Evento "fetch": Se dispara CADA VEZ que la app pide un recurso
self.addEventListener('fetch', (e) => {
  // No queremos cachear las peticiones a las APIs (Hacienda, NHTSA)
  // Si la URL de la petición incluye 'api', la dejamos pasar a la red.
  if (e.request.url.includes('api.hacienda.go.cr') || e.request.url.includes('vpic.nhtsa.dot.gov')) {
    console.log(`[Service Worker] Petición API (pasa a red): ${e.request.url}`);
    // Para APIs, siempre vamos a la red
    return fetch(e.request); 
  }

  // Para todo lo demás (HTML, íconos, scripts CDN)
  e.respondWith(
    caches.match(e.request).then((response) => {
      // Si el recurso ESTÁ en la caché, lo retornamos desde ahí
      if (response) {
        console.log(`[Service Worker] Sirviendo desde caché: ${e.request.url}`);
        return response;
      }
      
      // Si NO está en la caché, lo pedimos a la red
      console.log(`[Service Worker] Pidiendo a la red: ${e.request.url}`);
      return fetch(e.request).then(
          (networkResponse) => {
              // Opcional: Cachear el recurso si no estaba
              return caches.open(CACHE_NAME).then((cache) => {
                  cache.put(e.request, networkResponse.clone());
                  return networkResponse;
              })
          }
      );
    })
  );
});
